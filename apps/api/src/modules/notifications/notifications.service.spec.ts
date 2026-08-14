import { HttpStatus } from '@nestjs/common';
import { NotificationLevel, NotificationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';

const notificationRecord = {
  content: '请升级到新版本以获得最新功能。',
  expiresAt: null,
  id: 'notification-1',
  level: NotificationLevel.WARNING,
  publishedAt: new Date('2026-08-17T08:00:00.000Z'),
  receipts: [],
  summary: 'Photo Lab 0.2.0 已发布',
  targetVersion: '0.2.0',
  title: '发现新版本',
  type: NotificationType.VERSION_UPGRADE,
};

function createHarness() {
  const findMany = vi.fn().mockResolvedValue([notificationRecord]);
  const count = vi.fn().mockResolvedValue(1);
  const findFirst = vi.fn().mockResolvedValue({ id: notificationRecord.id });
  const create = vi.fn().mockResolvedValue(notificationRecord);
  const upsert = vi.fn().mockResolvedValue({ readAt: new Date('2026-08-17T09:00:00.000Z') });
  const publish = vi.fn();
  const prisma = {
    notification: { count, create, findFirst, findMany },
    notificationReceipt: { upsert },
  } as unknown as PrismaService;
  const stream = { publish } as unknown as NotificationStreamService;

  return {
    count,
    create,
    findFirst,
    findMany,
    publish,
    service: new NotificationsService(prisma, stream),
    upsert,
  };
}

describe('NotificationsService', () => {
  it('lists visible notifications with unread state and count', async () => {
    const harness = createHarness();
    const query = { limit: 20 } as ListNotificationsQueryDto;

    await expect(harness.service.listNotifications('user-1', query)).resolves.toEqual({
      items: [
        {
          expiresAt: null,
          id: 'notification-1',
          isRead: false,
          level: NotificationLevel.WARNING,
          publishedAt: '2026-08-17T08:00:00.000Z',
          summary: 'Photo Lab 0.2.0 已发布',
          title: '发现新版本',
          type: NotificationType.VERSION_UPGRADE,
        },
      ],
      nextCursor: null,
      unreadCount: 1,
    });
    expect(harness.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 21,
      }),
    );
    expect(harness.count).toHaveBeenCalledOnce();
  });

  it('filters notifications by the requested read state', async () => {
    const unreadHarness = createHarness();
    const readHarness = createHarness();

    await unreadHarness.service.listNotifications('user-1', {
      isRead: false,
      limit: 20,
    } as ListNotificationsQueryDto);
    await readHarness.service.listNotifications('user-1', {
      isRead: true,
      limit: 20,
    } as ListNotificationsQueryDto);

    expect(unreadHarness.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ receipts: { none: { userId: 'user-1' } } }]),
        }),
      }),
    );
    expect(readHarness.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ receipts: { some: { userId: 'user-1' } } }]),
        }),
      }),
    );
  });

  it('returns notification details with the current user read state', async () => {
    const harness = createHarness();
    harness.findFirst.mockResolvedValue({
      ...notificationRecord,
      receipts: [{ readAt: new Date('2026-08-17T09:00:00.000Z') }],
    });

    await expect(harness.service.getNotification('user-1', 'notification-1')).resolves.toEqual(
      expect.objectContaining({
        content: notificationRecord.content,
        isRead: true,
        targetVersion: '0.2.0',
      }),
    );
  });

  it('marks a visible notification as read idempotently', async () => {
    const harness = createHarness();

    await expect(harness.service.markNotificationRead('user-1', 'notification-1')).resolves.toEqual(
      {
        id: 'notification-1',
        isRead: true,
        readAt: '2026-08-17T09:00:00.000Z',
      },
    );
    expect(harness.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_notificationId: {
            notificationId: 'notification-1',
            userId: 'user-1',
          },
        },
      }),
    );
  });

  it('persists a published notification before broadcasting it', async () => {
    const harness = createHarness();

    await harness.service.publishNotification({
      content: notificationRecord.content,
      level: NotificationLevel.WARNING,
      summary: notificationRecord.summary,
      targetVersion: '0.2.0',
      title: notificationRecord.title,
      type: NotificationType.VERSION_UPGRADE,
    });

    expect(harness.create).toHaveBeenCalledOnce();
    expect(harness.publish).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      publishedAt: '2026-08-17T08:00:00.000Z',
    });
    expect(harness.create.mock.invocationCallOrder[0]).toBeLessThan(
      harness.publish.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects an expiry that is not after publication', async () => {
    const harness = createHarness();

    try {
      await harness.service.publishNotification({
        content: '正文',
        expiresAt: '2026-08-17T08:00:00.000Z',
        level: NotificationLevel.INFO,
        publishedAt: '2026-08-17T09:00:00.000Z',
        summary: '摘要',
        title: '标题',
        type: NotificationType.SYSTEM,
      });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
  });
});
