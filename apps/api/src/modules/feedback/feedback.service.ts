import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { NotificationLevel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';
import type { FeedbackDto } from './dto/feedback.dto';

const feedbackSelect = {
  category: true,
  createdAt: true,
  referenceId: true,
} satisfies Prisma.FeedbackSelect;

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto): Promise<FeedbackDto> {
    const referenceId = createReferenceId();
    // 反馈与对应的个人通知必须一起成功，避免通知中心出现没有反馈记录的条目。
    const feedback = await this.prisma.$transaction(async (transaction) => {
      const createdFeedback = await transaction.feedback.create({
        data: {
          category: dto.category,
          message: dto.message.trim(),
          referenceId,
          userId,
        },
        select: feedbackSelect,
      });

      await transaction.notification.create({
        data: {
          content: `反馈编号：${referenceId}\n\n你的反馈已成功发送，正在等待管理员处理。处理结果将通过通知中心告知。`,
          level: NotificationLevel.INFO,
          recipientUserId: userId,
          summary: `反馈 ${referenceId} 已成功发送，正在等待管理员处理。`,
          title: `反馈已提交 · ${referenceId}`,
          type: NotificationType.SYSTEM,
        },
      });

      return createdFeedback;
    });

    return {
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}

function createReferenceId(): string {
  return `PL-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}
