import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendsPage } from '../../../src/pages/FriendsPage';
import { useAuthStore } from '../../../src/stores/auth.store';

const api = vi.hoisted(() => ({
  readNearbyUsers: vi.fn(),
  readFriendRequests: vi.fn(),
  readFriends: vi.fn(),
  performFriendAction: vi.fn(),
  saveLocationSettings: vi.fn(),
}));
const state = vi.hoisted(() => ({ useLocationStatus: vi.fn() }));
vi.mock('../../../src/api/friends', () => ({
  ...api,
  friendsQueryKey: ['friends'],
  locationsQueryKey: ['locations'],
}));
vi.mock('../../../src/components/friends/LocationProvider', () => state);
vi.mock('../../../src/components/friends/CurrentLocationAddress', () => ({
  CurrentLocationAddress: () => null,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

function mount(route = '/friends') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={client}>
        <MantineProvider>
          <FriendsPage />
        </MantineProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('nearby friends page', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: {
        id: 'user-a',
        username: 'Alice',
        email: 'alice@example.com',
        createdAt: '',
        updatedAt: '',
      },
    });
    state.useLocationStatus.mockReturnValue({
      settings: { locationEnabled: true, discoverable: false },
      config: {
        location: { ttlMs: 12 * 3_600_000, refreshIntervalMs: 120_000 },
        nearby: { radiusMeters: 2500, maxAccuracyMeters: 300 },
        list: { refetchIntervalMs: 30_000 },
      },
      location: {
        latitude: 35,
        longitude: 139,
        accuracyMeters: 250,
        capturedAt: new Date().toISOString(),
      },
      uploaded: true,
      collecting: false,
      error: null,
      settingsError: false,
      refresh: vi.fn(),
    });
    api.readNearbyUsers.mockResolvedValue({
      items: [
        {
          userId: 'user-b',
          username: 'Bob',
          approximateDistanceMeters: 500,
          relationshipState: 'NONE',
          requestId: null,
          relationshipId: null,
          cooldownUntil: null,
        },
      ],

      radiusMeters: 2500,
    });
    api.readFriendRequests.mockResolvedValue({
      items: [
        {
          requestId: 'request-a',
          status: 'PENDING',
          userId: 'user-b',
          username: 'Bob',
          requestedAt: new Date().toISOString(),
        },
      ],
    });
    api.readFriends.mockResolvedValue({ items: [] });
    api.performFriendAction.mockResolvedValue(undefined);
  });

  it('uses the supplied search policy and submits a friend request', async () => {
    mount();
    expect(screen.getByText('附近 2,500 米')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '添加好友' }));
    await waitFor(() =>
      expect(api.performFriendAction.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          action: 'send',
          userId: 'user-b',
        }),
      ),
    );
  });

  it('opens received requests from a notification link and accepts by request ID', async () => {
    mount('/friends?tab=incoming');
    expect(screen.getByText('我的位置')).not.toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: '同意' }));
    await waitFor(() =>
      expect(api.performFriendAction.mock.calls[0]?.[0]).toEqual({
        action: 'accept',
        requestId: 'request-a',
      }),
    );
    fireEvent.click(screen.getByRole('tab', { name: '附近的人' }));
    expect(screen.getByText('我的位置')).toBeVisible();
  });

  it('refreshes the nearby list without collecting a new location', async () => {
    mount();
    const button = await screen.findByRole('button', { name: '刷新列表' });
    const previousCalls = api.readNearbyUsers.mock.calls.length;
    let finish!: (value: unknown) => void;
    api.readNearbyUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(button);
    await waitFor(() => expect(api.readNearbyUsers).toHaveBeenCalledTimes(previousCalls + 1));
    expect(await screen.findByRole('button', { name: '刷新中…' })).toBeDisabled();
    expect(state.useLocationStatus().refresh).not.toHaveBeenCalled();
    finish({ items: [], radiusMeters: 2500 });
    expect(await screen.findByRole('button', { name: '刷新列表' })).toBeEnabled();
    expect(await screen.findByText(/暂无可发现的用户/)).toBeInTheDocument();
  });

  it('keeps the previous nearby list while a new position is uploading', async () => {
    mount();
    await screen.findByRole('button', { name: '添加好友' });
    state.useLocationStatus.mockReturnValue({
      ...state.useLocationStatus(),
      collecting: true,
      uploaded: false,
    });
    fireEvent.click(screen.getByRole('tab', { name: '我的好友' }));
    fireEvent.click(screen.getByRole('tab', { name: '附近的人' }));
    expect(screen.getByRole('tabpanel', { name: '附近的人' })).toHaveTextContent('Bob');
    expect(screen.getByRole('button', { name: '添加好友' })).toBeDisabled();
    expect(screen.queryByText('正在等待有效位置，请稍后或点击更新位置。')).not.toBeInTheDocument();
  });

  it.each([
    ['REJECTED', '\u5df2\u62d2\u7edd'],
    ['ACCEPTED', '\u5df2\u901a\u8fc7'],
    ['CANCELLED', '\u5df2\u64a4\u56de'],
    ['EXPIRED', '\u5df2\u8fc7\u671f'],
  ])('shows outgoing %s requests without a cancel action', async (status, label) => {
    api.readFriendRequests.mockResolvedValue({
      items: [
        { requestId: 'history-a', username: 'Bob', status, requestedAt: new Date().toISOString() },
      ],
    });
    mount('/friends?tab=outgoing');
    await waitFor(() => expect(screen.getAllByText(label)).toHaveLength(3));
    expect(screen.queryByRole('button', { name: '\u64a4\u56de' })).not.toBeInTheDocument();
  });
  it('filters incoming history and preserves separate tab selections', async () => {
    api.readFriendRequests.mockImplementation(async (_direction, _signal, status) => ({
      items: [
        {
          requestId: 'history-b',
          username: 'Historical user',
          status: status ?? 'REJECTED',
          requestedAt: new Date().toISOString(),
        },
      ],
    }));
    mount('/friends?tab=incoming');
    await screen.findByText('Historical user');
    expect(screen.queryByRole('button', { name: '\u540c\u610f' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '\u62d2\u7edd' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '\u5df2\u62d2\u7edd' }));
    await waitFor(() =>
      expect(api.readFriendRequests).toHaveBeenLastCalledWith(
        'incoming',
        expect.any(AbortSignal),
        'REJECTED',
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: '\u53d1\u51fa\u7684\u7533\u8bf7' }));
    await waitFor(() =>
      expect(api.readFriendRequests).toHaveBeenLastCalledWith(
        'outgoing',
        expect.any(AbortSignal),
        undefined,
      ),
    );
    expect(screen.getByRole('radio', { name: '\u5168\u90e8' })).toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: '\u6536\u5230\u7684\u7533\u8bf7' }));
    expect(screen.getByRole('radio', { name: '\u5df2\u62d2\u7edd' })).toBeChecked();
  });
});
