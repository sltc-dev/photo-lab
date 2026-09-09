import { FeedbackCategory, NotificationLevel, NotificationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import { FeedbackService } from '../feedback.service';

describe('FeedbackService', () => {
  it('stores feedback and a private user notification in one transaction', async () => {
    const createFeedback = vi.fn(async ({ data }) => ({
      category: data.category,
      createdAt: new Date('2026-08-31T08:00:00.000Z'),
      referenceId: data.referenceId,
    }));
    const createNotification = vi.fn().mockResolvedValue({ id: 'notification-1' });
    const transaction = {
      feedback: { create: createFeedback },
      notification: { create: createNotification },
    };
    const prisma = {
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService;
    const service = new FeedbackService(prisma);

    const result = await service.create('user-1', {
      category: FeedbackCategory.BUG,
      message: '  上传失败  ',
    });

    expect(createFeedback).toHaveBeenCalledWith({
      data: {
        category: FeedbackCategory.BUG,
        message: '上传失败',
        referenceId: expect.stringMatching(/^PL-[A-F0-9]{12}$/),
        userId: 'user-1',
      },
      select: {
        category: true,
        createdAt: true,
        referenceId: true,
      },
    });
    expect(createNotification).toHaveBeenCalledWith({
      data: {
        content: expect.stringMatching(
          /^反馈编号：PL-[A-F0-9]{12}\n\n你的反馈已成功发送，正在等待管理员处理。处理结果将通过通知中心告知。$/,
        ),
        level: NotificationLevel.INFO,
        recipientUserId: 'user-1',
        summary: expect.stringMatching(/^反馈 PL-[A-F0-9]{12} 已成功发送，正在等待管理员处理。$/),
        title: expect.stringMatching(/^反馈已提交 · PL-[A-F0-9]{12}$/),
        type: NotificationType.SYSTEM,
      },
    });
    expect(result.createdAt).toBe('2026-08-31T08:00:00.000Z');
    expect(result.referenceId).toMatch(/^PL-[A-F0-9]{12}$/);
  });
});
