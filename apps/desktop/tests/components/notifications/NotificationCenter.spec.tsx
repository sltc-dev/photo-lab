import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationCenter } from '../../../src/components/notifications/NotificationCenter';
import { NotificationsPage } from '../../../src/pages/NotificationsPage';

const apiMocks = vi.hoisted(() => ({
  getNotificationDetail: vi.fn(),
  getNotifications: vi.fn(),
  readNotification: vi.fn(),
  subscribeNotificationStream: vi.fn(),
}));

vi.mock('../../../src/api/notifications', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/notifications')>();

  return {
    ...original,
    getNotificationDetail: apiMocks.getNotificationDetail,
    getNotifications: apiMocks.getNotifications,
    readNotification: apiMocks.readNotification,
    subscribeNotificationStream: apiMocks.subscribeNotificationStream,
  };
});

const notification = {
  expiresAt: null,
  id: 'notification-1',
  isRead: false,
  level: 'WARNING' as const,
  publishedAt: '2026-08-17T08:00:00.000Z',
  summary: '建议升级以获得最新功能。',
  title: '发现新版本 0.2.0',
  type: 'VERSION_UPGRADE' as const,
};

const readNotificationItem = {
  ...notification,
  id: 'notification-2',
  isRead: true,
  title: '已阅读的系统维护通知',
  type: 'SYSTEM' as const,
};

function renderNotifications(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <NotificationCenter />
          <Routes>
            <Route element={<NotificationsPage />} path="/notifications" />
            <Route element={<NotificationsPage />} path="/notifications/:notificationId" />
            <Route element={null} path="*" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    apiMocks.getNotifications.mockReset();
    apiMocks.getNotificationDetail.mockReset();
    apiMocks.readNotification.mockReset();
    apiMocks.subscribeNotificationStream.mockReset();
    apiMocks.getNotifications.mockImplementation((isRead?: boolean) =>
      Promise.resolve({
        items: isRead === false ? [notification] : [notification, readNotificationItem],
        nextCursor: null,
        unreadCount: 1,
      }),
    );
    apiMocks.getNotificationDetail.mockResolvedValue({
      ...notification,
      content: '本次更新包含通知中心、性能改进和问题修复。',
      targetVersion: '0.2.0',
    });
    apiMocks.readNotification.mockResolvedValue(undefined);
    apiMocks.subscribeNotificationStream.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
  });

  it('links the unread bell to the notification page', async () => {
    renderNotifications();

    const notificationLink = await screen.findByRole('link', { name: '查看通知，1 条未读' });
    expect(notificationLink).toHaveAttribute('href', '/notifications');
  });

  it('navigates from the notification page to details and marks the item as read', async () => {
    renderNotifications('/notifications');
    expect(await screen.findByRole('heading', { name: '通知中心' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('link', { name: '查看通知：发现新版本 0.2.0' }));

    expect(
      await screen.findByText('本次更新包含通知中心、性能改进和问题修复。'),
    ).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.readNotification).toHaveBeenCalledWith('notification-1'));
    expect(apiMocks.getNotificationDetail).toHaveBeenCalledWith('notification-1');
  });

  it('supports a URL-backed unread tab', async () => {
    renderNotifications('/notifications?filter=unread');

    expect(await screen.findByRole('tab', { name: '未读 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(apiMocks.getNotifications).toHaveBeenCalledWith(false));
    const unreadPanel = screen.getByRole('tabpanel');
    expect(within(unreadPanel).getByText('发现新版本 0.2.0')).toBeInTheDocument();
    expect(within(unreadPanel).queryByText('已阅读的系统维护通知')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '全部 2' }));
    expect(
      within(screen.getByRole('tabpanel')).getByText('已阅读的系统维护通知'),
    ).toBeInTheDocument();
  });
});
