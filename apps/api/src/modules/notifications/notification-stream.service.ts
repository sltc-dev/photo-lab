import { Injectable, type MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';

export type NotificationPublishedEvent = {
  notificationId: string;
  publishedAt: string;
};

@Injectable()
export class NotificationStreamService {
  private readonly publishedEvents = new Subject<NotificationPublishedEvent>();

  publish(event: NotificationPublishedEvent): void {
    this.publishedEvents.next(event);
  }

  stream(): Observable<MessageEvent> {
    const notifications = this.publishedEvents.pipe(
      map((event) => ({
        data: event,
        type: 'notification.published',
      })),
    );
    const heartbeat = interval(25_000).pipe(
      map(() => ({
        data: { at: new Date().toISOString() },
        type: 'heartbeat',
      })),
    );

    return merge(notifications, heartbeat);
  }
}
