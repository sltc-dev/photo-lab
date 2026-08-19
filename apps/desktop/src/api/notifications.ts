import {
  getNotification,
  listNotifications,
  markNotificationRead,
  type NotificationDetailDto,
  type NotificationListItemDto,
  type NotificationPageDto,
} from '../generated/api';
import { fetchWithAuth, resolveApiUrl } from './http';

export const notificationsQueryKey = ['notifications'] as const;
export const notificationListQueryKey = (isRead?: boolean) =>
  [...notificationsQueryKey, 'list', { isRead }] as const;
export const notificationDetailQueryKey = (notificationId: string) =>
  [...notificationsQueryKey, 'detail', notificationId] as const;

export type AppNotification = NotificationListItemDto;
export type AppNotificationDetail = NotificationDetailDto;
export type AppNotificationPage = NotificationPageDto;

export async function getNotifications(isRead?: boolean): Promise<AppNotificationPage> {
  const response = await listNotifications({
    query: { ...(isRead === undefined ? {} : { isRead }), limit: 50 },
    throwOnError: true,
  });

  return response.data;
}

export async function getNotificationDetail(
  notificationId: string,
): Promise<AppNotificationDetail> {
  const response = await getNotification({
    path: { notificationId },
    throwOnError: true,
  });

  return response.data;
}

export async function readNotification(notificationId: string): Promise<void> {
  await markNotificationRead({
    path: { notificationId },
    throwOnError: true,
  });
}

export type NotificationPublishedEvent = {
  notificationId: string;
  publishedAt: string;
};

export async function subscribeNotificationStream(
  onNotification: (event: NotificationPublishedEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetchWithAuth(resolveApiUrl('/notifications/stream'), {
    headers: { Accept: 'text/event-stream' },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`通知实时连接失败 (${response.status})`);
  }
  //前端一直等待后端发送数据
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replaceAll('\r\n', '\n');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      parseEventBlock(block, onNotification);
      separatorIndex = buffer.indexOf('\n\n');
    }

    if (done) return;
  }
}

function parseEventBlock(
  block: string,
  onNotification: (event: NotificationPublishedEvent) => void,
): void {
  const lines = block.split('\n');
  const eventType = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();

  if (eventType !== 'notification.published') return;

  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  try {
    const parsed = JSON.parse(data) as Partial<NotificationPublishedEvent>;
    if (typeof parsed.notificationId === 'string' && typeof parsed.publishedAt === 'string') {
      onNotification(parsed as NotificationPublishedEvent);
    }
  } catch {
    // 单条格式异常不应该终止长期连接；下一条事件仍可继续处理。
  }
}
