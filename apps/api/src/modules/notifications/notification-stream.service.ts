import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import type { NotificationPublishedEvent } from './notification-event';

@Injectable()
export class NotificationStreamService {
  private readonly logger = new Logger(NotificationStreamService.name);
  //Subject 可以简单理解为一个事件广播器：SSE 连接订阅它；发布通知时向它写入事件；它将事件推送给所有当前订阅者。
  private readonly publishedEvents = new Subject<NotificationPublishedEvent>();

  publish(event: NotificationPublishedEvent): void {
    this.logger.log(
      `event=notification_sse_publish notificationId=${event.notificationId} hasSubscribers=${this.publishedEvents.observed}`,
    );
    this.publishedEvents.next(event);
  }
  //返回一个持续产生事件的 RxJS 数据流，NestJS 会订阅这个数据流，并把每次产生的数据通过 SSE 推送给前端。
  stream(): Observable<MessageEvent> {
    const notifications = this.publishedEvents.pipe(
      map((event) => ({
        data: event,
        type: 'notification.published',
      })),
    );
    //心跳主要用于保持长连接活跃。因为 SSE 可能很久都没有真正的通知，如果长时间没有任何数据：网关可能主动关闭连接；客户端不容易判断连接是否还正常；
    const heartbeat = interval(25_000).pipe(
      map(() => ({
        data: { at: new Date().toISOString() },
        type: 'heartbeat',
      })),
    );

    //把通知事件和心跳事件都放进同一条 SSE 长连接中，发送给前端
    return merge(notifications, heartbeat);
  }
}
