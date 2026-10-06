import { HttpStatus, Injectable } from '@nestjs/common';
import { FriendRequestStatus, NotificationType, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { canonicalUserPair } from '../locations/location-policy';
import { NotificationEventPublisher } from '../notifications/notification-event-publisher.service';
import {
  CreateFriendRequestDto,
  FriendDto,
  FriendPageDto,
  FriendRequestDto,
  FriendRequestListQueryDto,
  FriendRequestPageDto,
} from './dto/friend.dto';

const requestInclude = {
  requester: { select: { id: true, username: true } },
  recipient: { select: { id: true, username: true } },
  friendship: true,
} satisfies Prisma.FriendRequestInclude;
type RequestRecord = Prisma.FriendRequestGetPayload<{ include: typeof requestInclude }>;
type Event = { notificationId: string; publishedAt: string };

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly publisher: NotificationEventPublisher,
  ) {}

  async createRequest(userId: string, dto: CreateFriendRequestDto): Promise<FriendRequestDto> {
    if (!dto.recipientUserId || dto.recipientUserId === userId) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', '请选择其他用户。');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientUserId },
      select: { id: true },
    });
    if (!recipient) this.notFound();
    let event: Event | null = null;

    const request = await this.prisma.$transaction(async (transaction) => {
      const pair = canonicalUserPair(userId, dto.recipientUserId);
      const requestPair = {
        OR: [
          { requesterId: userId, recipientId: dto.recipientUserId },
          { requesterId: dto.recipientUserId, recipientId: userId },
        ],
      };
      const now = new Date();
      await transaction.$executeRaw`UPDATE "FriendRequest" SET "status" = 'EXPIRED', "resolvedAt" = "expiresAt", "updatedAt" = ${now} WHERE (("requesterId" = ${userId} AND "recipientId" = ${dto.recipientUserId}) OR ("requesterId" = ${dto.recipientUserId} AND "recipientId" = ${userId})) AND "status" = 'PENDING' AND "expiresAt" <= ${now}`;

      const activeFriendship = await transaction.friendship.findFirst({
        where: { ...pair, removedAt: null },
      });
      if (activeFriendship) this.conflict('你们已经是好友。');

      const pending = await transaction.friendRequest.findFirst({
        where: { ...requestPair, status: 'PENDING' },
        include: requestInclude,
      });
      if (pending) return pending;

      const rejectedRequest = await transaction.friendRequest.findFirst({
        where: { ...requestPair, status: 'REJECTED' },
        orderBy: { resolvedAt: 'desc' },
      });
      const closedAt = rejectedRequest?.resolvedAt?.getTime() ?? 0;
      if (closedAt + this.locations.config.friendRequest.cooldownMs > now.getTime()) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'FRIEND_REQUEST_COOLDOWN',
          '申请被拒绝后，请等待冷却期结束再申请。',
          {
            cooldownUntil: new Date(
              closedAt + this.locations.config.friendRequest.cooldownMs,
            ).toISOString(),
          },
        );
      }

      await this.locations.assertNearby(transaction, userId, dto.recipientUserId);
      const created = await transaction.friendRequest.create({
        data: {
          requesterId: userId,
          recipientId: dto.recipientUserId,
          requestedAt: now,
          expiresAt: new Date(now.getTime() + this.locations.config.friendRequest.ttlMs),
        },
        include: requestInclude,
      });
      event = await this.createNotification(
        transaction,
        created,
        dto.recipientUserId,
        NotificationType.FRIEND_REQUEST,
      );
      return created;
    });

    await this.publish(event);
    return this.toRequestDto(request, userId);
  }

  async resolveRequest(
    userId: string,
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
  ): Promise<FriendRequestDto> {
    const initial = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!initial || (initial.requesterId !== userId && initial.recipientId !== userId))
      this.notFound();
    let event: Event | null = null;

    const request = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.friendRequest.findUnique({
        where: { id: requestId },
        include: requestInclude,
      });
      if (!current) this.notFound();

      const authorized =
        action === 'cancel' ? current.requesterId === userId : current.recipientId === userId;
      if (!authorized)
        throw new AppException(HttpStatus.FORBIDDEN, 'HTTP_ERROR', '你无权进行此操作。');

      const status =
        action === 'accept'
          ? FriendRequestStatus.ACCEPTED
          : action === 'reject'
            ? FriendRequestStatus.REJECTED
            : FriendRequestStatus.CANCELLED;
      if (current.status === status) return current;
      if (current.status !== 'PENDING') this.conflict();

      const now = new Date();
      if (current.expiresAt <= now) {
        throw new AppException(HttpStatus.CONFLICT, 'FRIEND_REQUEST_EXPIRED', '该好友申请已过期。');
      }

      await transaction.friendRequest.update({
        where: { id: requestId },
        data: { status, resolvedAt: now },
      });
      if (action === 'accept') {
        await transaction.friendship.create({
          data: {
            ...canonicalUserPair(current.requesterId, current.recipientId),
            sourceRequestId: requestId,
            createdAt: now,
          },
        });
        event = await this.createNotification(
          transaction,
          current,
          current.requesterId,
          NotificationType.FRIEND_ACCEPTED,
        );
      }

      return transaction.friendRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: requestInclude,
      });
    });

    await this.publish(event);
    return this.toRequestDto(request, userId);
  }

  async listRequests(
    userId: string,
    query: FriendRequestListQueryDto,
  ): Promise<FriendRequestPageDto> {
    const now = new Date();
    const filters: Prisma.FriendRequestWhereInput[] = [];

    if (query.status === 'PENDING') {
      filters.push({ status: 'PENDING', expiresAt: { gt: now } });
    } else if (query.status === 'EXPIRED') {
      filters.push({
        OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }],
      });
    } else if (query.status) {
      filters.push({ status: query.status });
    }

    const records = await this.prisma.friendRequest.findMany({
      where: {
        ...(query.direction === 'incoming' ? { recipientId: userId } : { requesterId: userId }),
        ...(filters.length ? { AND: filters } : {}),
      },
      include: requestInclude,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: records.map((request) => this.toRequestDto(request, userId)),
    };
  }

  async listFriends(userId: string): Promise<FriendPageDto> {
    const records = await this.prisma.friendship.findMany({
      where: {
        removedAt: null,
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
      include: {
        userLow: { select: { id: true, username: true } },
        userHigh: { select: { id: true, username: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: records.map((record): FriendDto => {
        const other = record.userLowId === userId ? record.userHigh : record.userLow;
        return {
          relationshipId: record.id,
          userId: other.id,
          username: other.username,
          createdAt: record.createdAt.toISOString(),
        };
      }),
    };
  }

  async removeFriend(userId: string, relationshipId: string): Promise<void> {
    const initial = await this.prisma.friendship.findUnique({ where: { id: relationshipId } });
    if (!initial || (initial.userLowId !== userId && initial.userHighId !== userId))
      this.notFound();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.friendship.updateMany({
        where: { id: relationshipId, removedAt: null },
        data: { removedAt: new Date() },
      });
    });
  }

  private toRequestDto(request: RequestRecord, userId: string): FriendRequestDto {
    const other = request.requesterId === userId ? request.recipient : request.requester;
    const expired = request.status === 'PENDING' && request.expiresAt <= new Date();
    return {
      requestId: request.id,
      userId: other.id,
      username: other.username,
      status: expired ? 'EXPIRED' : request.status,
      requestedAt: request.requestedAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
      resolvedAt: expired
        ? request.expiresAt.toISOString()
        : (request.resolvedAt?.toISOString() ?? null),
      relationshipId: request.friendship?.id ?? null,
      removedAt: request.friendship?.removedAt?.toISOString() ?? null,
    };
  }

  private async createNotification(
    transaction: Prisma.TransactionClient,
    request: RequestRecord,
    recipientUserId: string,
    type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED',
  ): Promise<Event> {
    const actor =
      type === 'FRIEND_REQUEST' ? request.requester.username : request.recipient.username;
    const title = type === 'FRIEND_REQUEST' ? '新的好友申请' : '好友申请已通过';
    const summary =
      type === 'FRIEND_REQUEST' ? `${actor} 请求添加你为好友。` : `${actor} 已通过你的好友申请。`;
    const notification = await transaction.notification.create({
      data: {
        recipientUserId,
        type,
        title,
        summary,
        content: summary,
        ...(type === 'FRIEND_REQUEST' ? { expiresAt: request.expiresAt } : {}),
      },
    });
    return { notificationId: notification.id, publishedAt: notification.publishedAt.toISOString() };
  }

  private async publish(event: Event | null): Promise<void> {
    if (event) await this.publisher.publish(event).catch(() => undefined);
  }

  private notFound(): never {
    throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '好友申请或用户不存在。');
  }

  private conflict(message = '好友申请状态已变化，请刷新后重试。'): never {
    throw new AppException(HttpStatus.CONFLICT, 'FRIEND_REQUEST_CONFLICT', message);
  }
}
