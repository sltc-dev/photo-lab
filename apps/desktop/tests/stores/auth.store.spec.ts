import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectIsAuthenticated, useAuthStore } from '../../src/stores/auth.store';

describe('auth store', () => {
  afterEach(() => {
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
  });

  it('restores a session through the Electron auth bridge', async () => {
    window.auth.refreshSession = vi.fn(async () => ({
      accessToken: 'fresh-access-token',
      user: {
        createdAt: new Date().toISOString(),
        email: 'admin@example.com',
        id: 'user-1',
        updatedAt: new Date().toISOString(),
        username: 'Admin',
      },
    }));

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().accessToken).toBe('fresh-access-token');
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    expect(useAuthStore.getState().currentUser?.email).toBe('admin@example.com');
  });

  it('shares one in-flight session restore across concurrent callers', async () => {
    type RefreshResult = Awaited<ReturnType<typeof window.auth.refreshSession>>;

    window.auth.refreshSession = vi.fn(
      async () =>
        new Promise<RefreshResult>((resolve) => {
          setTimeout(() => {
            resolve({
              accessToken: 'fresh-access-token',
              user: {
                createdAt: new Date().toISOString(),
                email: 'admin@example.com',
                id: 'user-1',
                updatedAt: new Date().toISOString(),
                username: 'Admin',
              },
            });
          }, 0);
        }),
    );

    await Promise.all([
      useAuthStore.getState().restoreSession(),
      useAuthStore.getState().restoreSession(),
    ]);

    expect(window.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-access-token');
  });

  it('returns to anonymous state when refresh fails', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-access-token',
      user: {
        createdAt: new Date().toISOString(),
        email: 'admin@example.com',
        id: 'user-1',
        updatedAt: new Date().toISOString(),
        username: 'Admin',
      },
    });
    window.auth.refreshSession = vi.fn(async () => {
      throw new Error('refresh failed');
    });

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
