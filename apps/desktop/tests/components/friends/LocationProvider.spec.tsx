import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocationProvider,
  useLocationStatus,
} from '../../../src/components/friends/LocationProvider';
import { useAuthStore } from '../../../src/stores/auth.store';

const api = vi.hoisted(() => ({
  readLocationSettings: vi.fn(),
  readNearbyFriendsConfig: vi.fn(),
  uploadLocation: vi.fn(),
}));
vi.mock('../../../src/api/friends', () => ({ ...api, locationsQueryKey: ['locations'] }));

const config = {
  location: { ttlMs: 6 * 3_600_000, refreshIntervalMs: 60_000, maxClockSkewMs: 30_000 },
  nearby: { radiusMeters: 1000, maxAccuracyMeters: 200, distanceBucketMeters: 50 },
  friendRequest: { ttlMs: 604800000, cooldownMs: 86400000 },
  maintenance: { intervalMs: 60_000 },
  list: { refetchIntervalMs: 30_000 },
};

function Status() {
  const status = useLocationStatus();
  return (
    <>
      <output>{status.uploaded ? 'Uploaded' : 'Not uploaded'}</output>
      {status.error && <p>{status.error}</p>}
      <button aria-busy={status.collecting} onClick={() => void status.refresh()}>
        Refresh
      </button>
    </>
  );
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
  const view = render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <LocationProvider>
          <Status />
        </LocationProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return { ...view, invalidateQueries };
}

describe('location collection lifecycle', () => {
  let success: (result: GeolocationPosition) => void;
  let getPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api.readLocationSettings.mockResolvedValue({
      locationEnabled: true,
      discoverable: false,
    });
    api.readNearbyFriendsConfig.mockResolvedValue(config);
    api.uploadLocation.mockImplementation(async (body) => ({
      ...body,
      expiresAt: new Date(
        new Date(body.capturedAt).getTime() + config.location.ttlMs,
      ).toISOString(),
    }));
    getPosition = vi.fn((callback: (position: GeolocationPosition) => void) => {
      success = callback;
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: getPosition },
    });
    window.locationControl = {
      requestAccess: vi.fn().mockResolvedValue(true),
      revokeAccess: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    useAuthStore.getState().setSession({
      accessToken: 'test-access-token',
      user: {
        id: 'user-a',
        username: 'Alice',
        email: 'alice@example.com',
        createdAt: '',
        updatedAt: '',
      },
    });
  });

  it('collects once in StrictMode and ignores manual refresh while a sample is pending', async () => {
    const view = mount();
    await waitFor(() => expect(getPosition).toHaveBeenCalledOnce());
    expect(screen.getByText('Refresh')).toHaveAttribute('aria-busy', 'true');
    screen.getByText('Refresh').click();
    expect(getPosition).toHaveBeenCalledOnce();
    await act(async () => {
      success({
        coords: { latitude: 35, longitude: 139, accuracy: 10 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeInTheDocument());
    expect(screen.getByText('Refresh')).toHaveAttribute('aria-busy', 'false');
    expect(api.uploadLocation).toHaveBeenCalledOnce();
    expect(view.invalidateQueries).not.toHaveBeenCalled();
  });

  it('remains busy until the collected position finishes uploading', async () => {
    let finishUpload!: (value: unknown) => void;
    api.uploadLocation.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );
    mount();
    await waitFor(() => expect(getPosition).toHaveBeenCalledOnce());
    await act(async () => {
      success({
        coords: { latitude: 35, longitude: 139, accuracy: 10 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(screen.getByText('Refresh')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Not uploaded')).toBeInTheDocument();
    await act(async () => {
      finishUpload({
        ...api.uploadLocation.mock.calls[0]![0],
        expiresAt: new Date().toISOString(),
      });
    });
    expect(screen.getByText('Refresh')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('does not upload a callback after the session changes', async () => {
    mount();
    await waitFor(() => expect(getPosition).toHaveBeenCalledOnce());
    await act(async () => {
      useAuthStore.getState().clearSession();
      success({
        coords: { latitude: 35, longitude: 139, accuracy: 10 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(api.uploadLocation).not.toHaveBeenCalled();
  });

  it('discards late callbacks when the provider unmounts', async () => {
    const view = mount();
    await waitFor(() => expect(getPosition).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => {
      success({
        coords: { latitude: 35, longitude: 139, accuracy: 10 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(api.uploadLocation).not.toHaveBeenCalled();
    expect(window.locationControl.revokeAccess).toHaveBeenCalled();
  });

  it('asks for permission first and skips locating when it is denied', async () => {
    vi.mocked(window.locationControl.requestAccess).mockResolvedValue(false);
    mount();
    await waitFor(() =>
      expect(
        screen.getByText('定位权限未开启，请在系统隐私设置中允许应用使用位置后重试。'),
      ).toBeInTheDocument(),
    );
    expect(window.locationControl.requestAccess).toHaveBeenCalled();
    expect(getPosition).not.toHaveBeenCalled();
    expect(api.uploadLocation).not.toHaveBeenCalled();
  });
});
