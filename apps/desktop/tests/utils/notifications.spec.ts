import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  resolveApiUrl: vi.fn((path: string) => `http://localhost:3000${path}`),
}));
const generatedApiMocks = vi.hoisted(() => ({
  getNotification: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('../../src/api/http', () => httpMocks);
vi.mock('../../src/generated/api', () => generatedApiMocks);

import { getNotifications, subscribeNotificationStream } from '../../src/api/notifications';

describe('subscribeNotificationStream', () => {
  beforeEach(() => {
    httpMocks.fetchWithAuth.mockReset();
    httpMocks.resolveApiUrl.mockClear();
    generatedApiMocks.listNotifications.mockReset();
  });

  it('passes the unread filter to the notifications endpoint', async () => {
    generatedApiMocks.listNotifications.mockResolvedValue({
      data: { items: [], nextCursor: null, unreadCount: 0 },
    });

    await getNotifications(false);

    expect(generatedApiMocks.listNotifications).toHaveBeenCalledWith({
      query: { isRead: false, limit: 50 },
      throwOnError: true,
    });
  });

  it('parses notification.published SSE events and ignores malformed events', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: notification.published\ndata: not-json\n\n' +
              'event: notification.published\ndata: {"notificationId":"notification-1","publishedAt":"2026-08-17T08:00:00.000Z"}\n\n',
          ),
        );
        controller.close();
      },
    });
    httpMocks.fetchWithAuth.mockResolvedValue(new Response(body, { status: 200 }));
    const onNotification = vi.fn();

    await subscribeNotificationStream(onNotification, new AbortController().signal);

    expect(httpMocks.resolveApiUrl).toHaveBeenCalledWith('/notifications/stream');
    expect(onNotification).toHaveBeenCalledOnce();
    expect(onNotification).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      publishedAt: '2026-08-17T08:00:00.000Z',
    });
  });

  it('throws when the realtime endpoint is unavailable', async () => {
    httpMocks.fetchWithAuth.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      subscribeNotificationStream(vi.fn(), new AbortController().signal),
    ).rejects.toThrow('通知实时连接失败 (503)');
  });
});
