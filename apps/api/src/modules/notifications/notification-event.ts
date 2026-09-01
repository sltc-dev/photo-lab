export const NOTIFICATION_REDIS_CHANNEL = 'photo-lab:notifications:published';

export type NotificationPublishedEvent = {
  notificationId: string;
  publishedAt: string;
};

export function parseNotificationPublishedEvent(value: string): NotificationPublishedEvent | null {
  try {
    const event = JSON.parse(value) as Partial<NotificationPublishedEvent>;

    return typeof event.notificationId === 'string' && typeof event.publishedAt === 'string'
      ? { notificationId: event.notificationId, publishedAt: event.publishedAt }
      : null;
  } catch {
    return null;
  }
}
