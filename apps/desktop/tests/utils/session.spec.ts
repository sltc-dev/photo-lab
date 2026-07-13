// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '../../src/api/query-client';
import { terminateSession } from '../../src/api/session';
import { selectIsAuthenticated, useAuthStore } from '../../src/stores/auth.store';

describe('session termination', () => {
  afterEach(() => {
    queryClient.clear();
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
  });

  it('clears renderer auth and server-state caches before revoking the stored token', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: {
        createdAt: new Date().toISOString(),
        email: 'admin@example.com',
        id: 'user-1',
        updatedAt: new Date().toISOString(),
        username: 'Admin',
      },
    });
    queryClient.setQueryData(['private-data'], { owner: 'user-1' });
    window.auth.logoutSession = vi.fn(async () => undefined);

    await terminateSession();

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(queryClient.getQueryData(['private-data'])).toBeUndefined();
    expect(window.auth.logoutSession).toHaveBeenCalledOnce();
  });

  it('keeps renderer state cleared when local token cleanup fails', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: {
        createdAt: new Date().toISOString(),
        email: 'admin@example.com',
        id: 'user-1',
        updatedAt: new Date().toISOString(),
        username: 'Admin',
      },
    });
    queryClient.setQueryData(['private-data'], { owner: 'user-1' });
    window.auth.logoutSession = vi.fn(async () => {
      throw new Error('token cleanup failed');
    });

    await expect(terminateSession()).rejects.toThrow('token cleanup failed');

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(queryClient.getQueryData(['private-data'])).toBeUndefined();
  });

  it('shares one in-flight token cleanup across concurrent callers', async () => {
    let finishLogout: (() => void) | undefined;
    window.auth.logoutSession = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
    );

    const first = terminateSession();
    const second = terminateSession();

    expect(window.auth.logoutSession).toHaveBeenCalledOnce();
    finishLogout?.();
    await Promise.all([first, second]);
  });
});
