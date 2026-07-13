// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApiClient, getApiErrorMessage } from '../../src/api/http';
import { queryClient } from '../../src/api/query-client';
import { me } from '../../src/generated/api';
import { useAuthStore } from '../../src/stores/auth.store';

describe('http', () => {
  configureApiClient();

  afterEach(() => {
    queryClient.clear();
    useAuthStore.getState().clearSession();
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "Error invoking remote method 'auth.login': ApiRequestError: 邮箱或密码错误",
      '邮箱或密码错误',
    ],
    [
      "Error invoking remote method 'auth.login': Error: Error while encrypting the text provided to safeStorage.encryptStringAsync.",
      'Error while encrypting the text provided to safeStorage.encryptStringAsync.',
    ],
  ])('removes Electron IPC implementation details from errors', async (message, expected) => {
    await expect(getApiErrorMessage(new Error(message))).resolves.toBe(expected);
  });

  it('refreshes the session and retries once after a 401 response', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-access-token',
      user: createUser(),
    });
    window.auth.refreshSession = vi.fn(async () => ({
      accessToken: 'fresh-access-token',
      user: createUser(),
    }));
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await me({ throwOnError: true });

    expect(result.data).toEqual({ ok: true });
    expect(window.auth.refreshSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[0] as Request).headers.get('Authorization')).toBe(
      'Bearer expired-access-token',
    );
    expect((fetchMock.mock.calls[1]?.[0] as Request).headers.get('Authorization')).toBe(
      'Bearer fresh-access-token',
    );
  });

  it('terminates the session when the retried request is still unauthorized', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-access-token',
      user: createUser(),
    });
    queryClient.setQueryData(['private-data'], { owner: 'user-1' });
    window.auth.refreshSession = vi.fn(async () => ({
      accessToken: 'rejected-access-token',
      user: createUser(),
    }));
    window.auth.logoutSession = vi.fn(async () => undefined);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
    );

    await expect(me({ throwOnError: true })).rejects.toBeDefined();

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(queryClient.getQueryData(['private-data'])).toBeUndefined();
    expect(window.auth.logoutSession).toHaveBeenCalledOnce();
  });

  it('clears renderer state without deleting the stored token when refresh fails', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-access-token',
      user: createUser(),
    });
    queryClient.setQueryData(['private-data'], { owner: 'user-1' });
    window.auth.refreshSession = vi.fn(async () => {
      throw new Error('service unavailable');
    });
    window.auth.logoutSession = vi.fn(async () => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(me({ throwOnError: true })).rejects.toBeDefined();

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(queryClient.getQueryData(['private-data'])).toBeUndefined();
    expect(window.auth.logoutSession).not.toHaveBeenCalled();
  });
});

function createUser() {
  // 测试共享的公开用户形状；不包含 passwordHash 等后端私有字段。
  return {
    createdAt: new Date().toISOString(),
    email: 'admin@example.com',
    id: 'user-1',
    updatedAt: new Date().toISOString(),
    username: 'User',
  };
}
