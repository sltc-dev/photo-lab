import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationPublishController } from './notification-publish.controller';
import { NotificationPublishGuard } from './notification-publish.guard';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, NotificationPublishController],
  imports: [PrismaModule, SecurityModule],
  providers: [NotificationsService, NotificationStreamService, NotificationPublishGuard],
})
export class NotificationsModule {}
