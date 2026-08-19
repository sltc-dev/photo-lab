import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PublishNotificationDto } from './dto/publish-notification.dto';
import { NotificationPublishGuard } from './notification-publish.guard';
import { NotificationsService } from './notifications.service';

@ApiExcludeController()
@UseGuards(NotificationPublishGuard)
@Controller('internal/notifications')
export class NotificationPublishController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  publishNotification(@Body() dto: PublishNotificationDto) {
    return this.notificationsService.publishNotification(dto);
  }
}
