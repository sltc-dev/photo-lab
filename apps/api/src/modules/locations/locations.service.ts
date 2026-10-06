import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type FriendRequest, type Friendship } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LocationDto,
  LocationSettingsDto,
  NearbyUsersDto,
  ReportLocationDto,
  UpdateLocationSettingsDto,
} from './dto/location.dto';
import { normalizeCapturedAt } from './location-policy';
import type { NearbyFriendsConfig } from '../../config/nearby-friends.config';

const locationSelect = {
  latitude: true,
  longitude: true,
  accuracyMeters: true,
  capturedAt: true,
  expiresAt: true,
} satisfies Prisma.UserLocationSelect;
type Candidate = { userId: string; username: string; distance: number };

@Injectable()
export class LocationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('NEARBY_FRIENDS_CONFIG') readonly config: NearbyFriendsConfig,
  ) {}

  getSettings(
    userId: string,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<LocationSettingsDto> {
    return transaction.userLocationSetting.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(
    userId: string,
    dto: UpdateLocationSettingsDto,
  ): Promise<LocationSettingsDto> {
    return this.prisma.$transaction(async (transaction) => {
      await this.getSettings(userId, transaction);
      const current = await transaction.userLocationSetting.findUniqueOrThrow({
        where: { userId },
      });

      const discoverable = dto.locationEnabled && dto.discoverable;
      if (
        current.locationEnabled === dto.locationEnabled &&
        current.discoverable === discoverable
      ) {
        return current;
      }

      const settings = await transaction.userLocationSetting.update({
        where: { userId },
        data: { locationEnabled: dto.locationEnabled, discoverable },
      });

      if (!settings.locationEnabled) {
        await transaction.userLocation.deleteMany({ where: { userId } });
      }

      return settings;
    });
  }

  async reportLocation(userId: string, dto: ReportLocationDto): Promise<LocationDto> {
    return this.prisma.$transaction(async (transaction) => {
      await this.getSettings(userId, transaction);
      const settings = await transaction.userLocationSetting.findUniqueOrThrow({
        where: { userId },
      });
      if (!settings.locationEnabled) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'LOCATION_DISABLED',
          '定位已关闭，请先开启定位。',
        );
      }

      const now = new Date();
      const capturedAt = normalizeCapturedAt(dto.capturedAt, now, this.config);
      const existing = await transaction.userLocation.findUnique({
        where: { userId },
        select: locationSelect,
      });
      if (existing && existing.capturedAt >= capturedAt) {
        return this.toLocationDto(existing);
      }

      const data = {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        capturedAt,
        receivedAt: now,
        expiresAt: new Date(capturedAt.getTime() + this.config.location.ttlMs),
      };
      const record = await transaction.userLocation.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
        select: locationSelect,
      });
      return this.toLocationDto(record);
    });
  }

  async getLocation(userId: string): Promise<LocationDto | null> {
    const settings = await this.getSettings(userId);
    if (!settings.locationEnabled) return null;

    const record = await this.prisma.userLocation.findFirst({
      where: { userId, capturedAt: { gt: new Date(Date.now() - this.config.location.ttlMs) } },
      select: locationSelect,
    });
    return record ? this.toLocationDto(record) : null;
  }

  async deleteLocation(userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.userLocation.deleteMany({ where: { userId } });
    });
  }

  async assertSearchLocation(
    userId: string,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const settings = await transaction.userLocationSetting.findUnique({ where: { userId } });
    if (!settings?.locationEnabled) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'LOCATION_DISABLED',
        '请先开启定位，再查找附近的人。',
      );
    }

    const location = await transaction.userLocation.findUnique({
      where: { userId },
      select: locationSelect,
    });
    if (!location || location.capturedAt.getTime() <= Date.now() - this.config.location.ttlMs) {
      throw new AppException(HttpStatus.CONFLICT, 'LOCATION_STALE', '位置信息已过期，请更新位置。');
    }
    if (location.accuracyMeters > this.config.nearby.maxAccuracyMeters) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'LOCATION_INACCURATE',
        `定位精度需在 ${this.config.nearby.maxAccuracyMeters} 米以内，请重新定位。`,
      );
    }
  }

  async assertNearby(
    transaction: Prisma.TransactionClient,
    userId: string,
    recipientId: string,
  ): Promise<void> {
    await this.assertSearchLocation(userId, transaction);
    const candidates = await this.queryCandidates(transaction, userId, recipientId);
    if (!candidates.length) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'NEARBY_USER_UNAVAILABLE',
        '该用户当前不在可发现的附近用户中。',
      );
    }
  }

  async getNearby(userId: string): Promise<NearbyUsersDto> {
    await this.assertSearchLocation(userId);
    const now = new Date();
    const candidates = await this.queryCandidates(this.prisma, userId);
    const ids = candidates.map((candidate) => candidate.userId);
    const pairWhere = {
      OR: [
        { userLowId: userId, userHighId: { in: ids } },
        { userHighId: userId, userLowId: { in: ids } },
      ],
    };
    let requests: FriendRequest[] = [];
    let friendships: Friendship[] = [];

    // 有候选人时并行查询申请和好友关系，避免逐个用户访问数据库。
    if (ids.length > 0) {
      [requests, friendships] = await Promise.all([
        this.prisma.friendRequest.findMany({
          where: {
            AND: [
              {
                // 同时包含我发出的申请和附近用户发给我的申请。
                OR: [
                  { requesterId: userId, recipientId: { in: ids } },
                  { recipientId: userId, requesterId: { in: ids } },
                ],
              },
              {
                // 只读取未过期的待处理申请，以及仍处于冷却期的拒绝记录。
                OR: [
                  { status: 'PENDING', expiresAt: { gt: now } },
                  {
                    status: 'REJECTED',
                    resolvedAt: {
                      gt: new Date(now.getTime() - this.config.friendRequest.cooldownMs),
                    },
                  },
                ],
              },
            ],
          },
          orderBy: { requestedAt: 'desc' },
        }),
        this.prisma.friendship.findMany({
          where: {
            AND: [pairWhere, { removedAt: null }],
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    }

    return {
      radiusMeters: this.config.nearby.radiusMeters,
      searchedAt: now.toISOString(),
      items: candidates.map((candidate) => {
        const request = requests.find(
          (item) => item.requesterId === candidate.userId || item.recipientId === candidate.userId,
        );
        const friendship = friendships.find(
          (item) => item.userLowId === candidate.userId || item.userHighId === candidate.userId,
        );
        const pending = request?.status === 'PENDING' && request.expiresAt > now;
        let cooldownUntil: Date | null = null;
        if (request?.status === 'REJECTED') {
          const closedAt = request.resolvedAt?.getTime();
          if (closedAt) {
            cooldownUntil = new Date(closedAt + this.config.friendRequest.cooldownMs);
          }
        }

        let relationshipId: string | null = null;
        let requestId: string | null = null;
        let cooldownUntilText: string | null = null;
        let relationshipState: NearbyUsersDto['items'][number]['relationshipState'] = 'NONE';

        if (pending) {
          requestId = request.id;
        }
        if (cooldownUntil && cooldownUntil > now) {
          cooldownUntilText = cooldownUntil.toISOString();
        }

        // 展示状态按好友、待处理申请、冷却期的顺序判断。
        if (friendship?.removedAt === null) {
          relationshipId = friendship.id;
          relationshipState = 'FRIEND';
        } else if (pending) {
          if (request.requesterId === userId) {
            relationshipState = 'OUTGOING_PENDING';
          } else {
            relationshipState = 'INCOMING_PENDING';
          }
        } else if (cooldownUntilText) {
          relationshipState = 'COOLDOWN';
        }

        return {
          userId: candidate.userId,
          username: candidate.username,
          approximateDistanceMeters:
            Math.ceil(candidate.distance / this.config.nearby.distanceBucketMeters) *
            this.config.nearby.distanceBucketMeters,
          relationshipId,
          requestId,
          cooldownUntil: cooldownUntilText,
          relationshipState,
        };
      }),
    };
  }

  private queryCandidates(
    transaction: Prisma.TransactionClient,
    userId: string,
    recipientId?: string,
  ): Promise<Candidate[]> {
    return transaction.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT candidate."userId", u."username", ST_Distance(candidate."position", own."position") AS distance
      FROM "UserLocation" own
      JOIN "UserLocationSetting" own_settings ON own_settings."userId" = own."userId" AND own_settings."locationEnabled"
      JOIN "UserLocation" candidate ON ST_DWithin(candidate."position", own."position", ${this.config.nearby.radiusMeters})
      JOIN "UserLocationSetting" settings ON settings."userId" = candidate."userId" AND settings."locationEnabled" AND settings."discoverable"
      JOIN "User" u ON u.id = candidate."userId"
      WHERE own."userId" = ${userId} AND candidate."userId" <> ${userId}
        AND own."capturedAt" > ${new Date(Date.now() - this.config.location.ttlMs)} AND candidate."capturedAt" > ${new Date(Date.now() - this.config.location.ttlMs)}
        AND own."accuracyMeters" <= ${this.config.nearby.maxAccuracyMeters} AND candidate."accuracyMeters" <= ${this.config.nearby.maxAccuracyMeters}
        ${recipientId ? Prisma.sql`AND candidate."userId" = ${recipientId}` : Prisma.empty}
      ORDER BY distance, candidate."userId"
    `);
  }

  private toLocationDto(record: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: Date;
    expiresAt: Date;
  }): LocationDto {
    return {
      ...record,
      capturedAt: record.capturedAt.toISOString(),
      expiresAt: new Date(record.capturedAt.getTime() + this.config.location.ttlMs).toISOString(),
    };
  }
}
