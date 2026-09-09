import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationEventPublisher } from './notification-event-publisher.service';
import { NotificationsService } from './notifications.service';

/** 通知业务核心，由 HTTP API 与命令行程序共同复用。 */
@Module({
  exports: [NotificationsService],
  imports: [PrismaModule],
  providers: [NotificationEventPublisher, NotificationsService],
})
export class NotificationCoreModule {}
