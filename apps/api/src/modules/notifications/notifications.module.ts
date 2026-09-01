import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationCoreModule } from './notification-core.module';
import { NotificationEventSubscriber } from './notification-event-subscriber.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  imports: [NotificationCoreModule, PrismaModule, SecurityModule],
  providers: [NotificationEventSubscriber, NotificationStreamService],
})
export class NotificationsModule {}
