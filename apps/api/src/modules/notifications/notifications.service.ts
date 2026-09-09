import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type {
  NotificationDetailDto,
  NotificationListItemDto,
  NotificationPageDto,
  NotificationReadDto,
} from './dto/notification.dto';
import type { PublishNotificationDto } from './dto/publish-notification.dto';
import { NotificationEventPublisher } from './notification-event-publisher.service';

const notificationSelect = {
  id: true,
  type: true,
  level: true,
  title: true,
  summary: true,
  content: true,
  targetVersion: true,
  publishedAt: true,
  expiresAt: true,
} satisfies Prisma.NotificationSelect;

function notificationListSelect(userId: string) {
  return {
    ...notificationSelect,
    receipts: {
      select: { readAt: true },
      where: { userId },
    },
  } satisfies Prisma.NotificationSelect;
}

type NotificationRecord = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;
type NotificationListRecord = Prisma.NotificationGetPayload<{
  select: ReturnType<typeof notificationListSelect>;
}>;

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NotificationEventPublisher)
    private readonly eventPublisher: NotificationEventPublisher,
  ) {}

  async listNotifications(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationPageDto> {
    const now = new Date();
    const visibilityWhere = this.getVisibilityWhere(now, userId);
    const readWhere =
      query.isRead === undefined
        ? {}
        : {
            receipts: query.isRead ? { some: { userId } } : { none: { userId } },
          };
    const where = {
      AND: [visibilityWhere, readWhere],
    } satisfies Prisma.NotificationWhereInput;

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: notificationListSelect(userId),
        take: query.limit + 1,
        where,
      }),
      this.prisma.notification.count({
        where: {
          AND: [visibilityWhere, { receipts: { none: { userId } } }],
        },
      }),
    ]);

    const hasMore = notifications.length > query.limit;
    const pageItems = hasMore ? notifications.slice(0, query.limit) : notifications;

    return {
      items: pageItems.map((notification) => this.toListItemDto(notification)),
      nextCursor: hasMore ? pageItems.at(-1)!.id : null,
      unreadCount,
    };
  }

  async getNotification(userId: string, notificationId: string): Promise<NotificationDetailDto> {
    const notification = await this.prisma.notification.findFirst({
      select: notificationListSelect(userId),
      where: {
        AND: [{ id: notificationId }, this.getVisibilityWhere(new Date(), userId)],
      },
    });

    if (!notification) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND', '通知不存在或已失效');
    }

    return {
      ...this.toListItemDto(notification),
      content: notification.content,
      targetVersion: notification.targetVersion,
    };
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<NotificationReadDto> {
    await this.ensureVisibleNotification(userId, notificationId);
    const receipt = await this.prisma.notificationReceipt.upsert({
      create: { notificationId, userId },
      select: { readAt: true },
      update: {},
      where: {
        userId_notificationId: { notificationId, userId },
      },
    });

    return {
      id: notificationId,
      isRead: true,
      readAt: receipt.readAt.toISOString(),
    };
  }

  async publishNotification(dto: PublishNotificationDto): Promise<NotificationRecord> {
    const publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= publishedAt) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        '通知失效时间必须晚于发布时间',
      );
    }

    const notification = await this.prisma.notification.create({
      data: {
        content: dto.content,
        expiresAt,
        level: dto.level,
        publishedAt,
        summary: dto.summary,
        targetVersion: dto.targetVersion || null,
        title: dto.title,
        type: dto.type,
      },
      select: notificationSelect,
    });

    await this.eventPublisher.publish({
      notificationId: notification.id,
      publishedAt: notification.publishedAt.toISOString(),
    });

    return notification;
  }

  private async ensureVisibleNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      select: { id: true },
      where: {
        AND: [{ id: notificationId }, this.getVisibilityWhere(new Date(), userId)],
      },
    });

    if (!notification) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND', '通知不存在或已失效');
    }
  }

  private getVisibilityWhere(now: Date, userId: string): Prisma.NotificationWhereInput {
    return {
      AND: [
        { publishedAt: { lte: now } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ recipientUserId: null }, { recipientUserId: userId }] },
      ],
    };
  }

  private toListItemDto(notification: NotificationListRecord): NotificationListItemDto {
    return {
      expiresAt: notification.expiresAt?.toISOString() ?? null,
      id: notification.id,
      isRead: notification.receipts.length > 0,
      level: notification.level,
      publishedAt: notification.publishedAt.toISOString(),
      summary: notification.summary,
      title: notification.title,
      type: notification.type,
    };
  }
}
