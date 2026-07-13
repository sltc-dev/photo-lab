// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, isInvalidRefreshTokenError } from '../../electron/auth/auth-api-client';
import { AuthSessionCoordinator } from '../../electron/auth/auth-session-coordinator';

interface Session {
  refreshToken: string;
}

// 用内存替代 Electron safeStorage，测试只关注会话操作的顺序和并发行为。
class MemoryTokenStore {
  readonly mutations: string[] = [];

  constructor(public token: string | null) {}

  async clearRefreshToken(): Promise<void> {
    this.mutations.push('clear');
    this.token = null;
  }

  async getRefreshToken(): Promise<string | null> {
    return this.token;
  }

  async saveRefreshToken(token: string): Promise<void> {
    this.mutations.push(`save:${token}`);
    this.token = token;
  }
}

describe('AuthSessionCoordinator', () => {
  it('runs logout after an in-flight refresh so the refreshed token cannot be restored later', async () => {
    const tokenStore = new MemoryTokenStore('old-refresh-token');
    const coordinator = new AuthSessionCoordinator<Session>(tokenStore);
    const refreshResponse = createDeferred<Session>();
    const refreshRequest = vi.fn(async () => refreshResponse.promise);
    const logoutRequest = vi.fn(async () => undefined);

    const refreshResult = coordinator.refreshSession(refreshRequest, isInvalidRefreshTokenError);
    const duplicateRefreshResult = coordinator.refreshSession(
      refreshRequest,
      isInvalidRefreshTokenError,
    );
    expect(duplicateRefreshResult).toBe(refreshResult);
    await vi.waitFor(() => expect(refreshRequest).toHaveBeenCalledWith('old-refresh-token'));

    const logoutResult = coordinator.logoutSession(logoutRequest);
    await Promise.resolve();
    expect(logoutRequest).not.toHaveBeenCalled();

    refreshResponse.resolve({ refreshToken: 'new-refresh-token' });
    await refreshResult;
    await logoutResult;

    expect(logoutRequest).toHaveBeenCalledWith('new-refresh-token');
    expect(tokenStore.mutations).toEqual(['save:new-refresh-token', 'clear']);
    expect(tokenStore.token).toBeNull();
  });

  it('serializes login and register token writes with refresh operations', async () => {
    const tokenStore = new MemoryTokenStore(null);
    const coordinator = new AuthSessionCoordinator<Session>(tokenStore);
    const loginResponse = createDeferred<Session>();
    const loginRequest = vi.fn(async () => loginResponse.promise);
    const refreshRequest = vi.fn(async () => ({ refreshToken: 'rotated-refresh-token' }));

    const loginResult = coordinator.createSession(loginRequest);
    await vi.waitFor(() => expect(loginRequest).toHaveBeenCalledOnce());
    const refreshResult = coordinator.refreshSession(refreshRequest, isInvalidRefreshTokenError);

    await Promise.resolve();
    expect(refreshRequest).not.toHaveBeenCalled();

    loginResponse.resolve({ refreshToken: 'login-refresh-token' });
    await loginResult;
    await refreshResult;

    expect(refreshRequest).toHaveBeenCalledWith('login-refresh-token');
    expect(tokenStore.mutations).toEqual([
      'save:login-refresh-token',
      'save:rotated-refresh-token',
    ]);
  });

  it.each([400, 401])('clears the stored token after a %i refresh response', async (status) => {
    const tokenStore = new MemoryTokenStore('old-refresh-token');
    const coordinator = new AuthSessionCoordinator<Session>(tokenStore);
    const error = new ApiRequestError('Refresh token is invalid.', status);

    await expect(
      coordinator.refreshSession(async () => Promise.reject(error), isInvalidRefreshTokenError),
    ).rejects.toBe(error);

    expect(tokenStore.token).toBeNull();
    expect(tokenStore.mutations).toEqual(['clear']);
  });

  it.each([
    ['a network failure', new TypeError('fetch failed')],
    ['a server failure', new ApiRequestError('Service unavailable.', 503)],
  ])('keeps the stored token after %s', async (_label, error) => {
    const tokenStore = new MemoryTokenStore('old-refresh-token');
    const coordinator = new AuthSessionCoordinator<Session>(tokenStore);

    await expect(
      coordinator.refreshSession(async () => Promise.reject(error), isInvalidRefreshTokenError),
    ).rejects.toBe(error);

    expect(tokenStore.token).toBe('old-refresh-token');
    expect(tokenStore.mutations).toEqual([]);
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  // 手动控制 Promise 完成时机，用来稳定复现两个刷新请求并发的场景。
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
