import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationDetailDto,
  NotificationPageDto,
  NotificationReadDto,
} from './dto/notification.dto';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly streamService: NotificationStreamService,
  ) {}

  @Get()
  @ApiOkResponse({ type: NotificationPageDto })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { default: 20, maximum: 50, minimum: 1, type: 'integer' },
  })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  listNotifications(
    @CurrentUser() user: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationPageDto> {
    return this.notificationsService.listNotifications(user.id, query);
  }

  //注册一个 GET 接口；不按照普通 JSON 接口一次性返回；每当产生一条数据，就把数据写入 HTTP 响应；
  @Sse('stream')
  @ApiExcludeEndpoint()
  streamNotifications(): Observable<MessageEvent> {
    return this.streamService.stream();
  }

  @Get(':notificationId')
  @ApiParam({ name: 'notificationId', type: String })
  @ApiOkResponse({ type: NotificationDetailDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  getNotification(
    @CurrentUser() user: RequestUser,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationDetailDto> {
    return this.notificationsService.getNotification(user.id, notificationId);
  }

  @Patch(':notificationId/read')
  @ApiParam({ name: 'notificationId', type: String })
  @ApiOkResponse({ type: NotificationReadDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  markNotificationRead(
    @CurrentUser() user: RequestUser,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationReadDto> {
    return this.notificationsService.markNotificationRead(user.id, notificationId);
  }
}
