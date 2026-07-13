import { client } from '../generated/api/client.gen';
import { clearRendererSession, terminateSession } from './session';
import { applyRefreshedSession, getAuthSessionEpoch, useAuthStore } from '../stores/auth.store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const retryHeader = 'x-photo-lab-auth-retry';

type RefreshSessionResult = Awaited<ReturnType<typeof window.auth.refreshSession>>;

let refreshPromise: Promise<RefreshSessionResult> | null = null;
let isConfigured = false;

class StaleSessionRefreshError extends Error {}

export function configureApiClient(): void {
  // React 启动时只配置一次生成客户端，所有业务请求统一经过 authFetch。
  if (isConfigured) {
    return;
  }

  client.setConfig({
    baseUrl: API_BASE_URL,
    fetch: authFetch,
    throwOnError: true,
  });
  isConfigured = true;
}

export async function getApiErrorMessage(error: unknown): Promise<string> {
  if (isApiErrorBody(error)) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return normalizeIpcErrorMessage(error.message);
  }

  if (typeof error === 'string') {
    return error;
  }

  return '请求失败';
}

function normalizeIpcErrorMessage(message: string): string {
  let normalized = message.replace(/^Error invoking remote method '[^']+':\s*/, '');

  while (/^(?:ApiRequestError|Error):\s*/.test(normalized)) {
    normalized = normalized.replace(/^(?:ApiRequestError|Error):\s*/, '');
  }

  return normalized || '请求失败';
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // epoch 用来识别“请求发出后用户已经退出/切换会话”的竞态。
  const requestEpoch = getAuthSessionEpoch();
  const request = input instanceof Request ? input : new Request(input, init);
  const requestWithAuth = withAuthHeader(request);
  const retryRequest = requestWithAuth.clone();
  const response = await globalThis.fetch(requestWithAuth);

  if (response.status !== 401 || requestWithAuth.headers.get(retryHeader) === '1') {
    // 非 401 直接返回；已经重试过的请求也不能无限刷新循环。
    return response;
  }

  if (getAuthSessionEpoch() !== requestEpoch) {
    return response;
  }

  try {
    // 多个并发 401 会复用同一个 refreshPromise。
    const session = await refreshAccessToken(requestEpoch);

    if (getAuthSessionEpoch() !== requestEpoch) {
      return response;
    }

    const retryHeaders = new Headers(retryRequest.headers);
    retryHeaders.set('Authorization', `Bearer ${session.accessToken}`);
    // 私有请求头只用于标记“已经重试一次”，防止再次遇到 401 时循环。
    retryHeaders.set(retryHeader, '1');

    const retryResponse = await globalThis.fetch(
      new Request(retryRequest, { headers: retryHeaders }),
    );

    if (retryResponse.status === 401 && getAuthSessionEpoch() === requestEpoch) {
      // 新 Token 仍被拒绝，说明会话无法恢复，清理本机状态。
      await terminateSession().catch(() => undefined);
    }

    return retryResponse;
  } catch (error) {
    if (!(error instanceof StaleSessionRefreshError) && getAuthSessionEpoch() === requestEpoch) {
      clearRendererSession();
    }
    return response;
  }
}

function withAuthHeader(request: Request): Request {
  // Access Token 只存在 Zustand 内存中，每次请求发送前临时写入 Header。
  const token = useAuthStore.getState().accessToken;

  if (!token || request.headers.has('Authorization')) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return new Request(request, { headers });
}

async function refreshAccessToken(expectedEpoch: number): Promise<RefreshSessionResult> {
  if (getAuthSessionEpoch() !== expectedEpoch) {
    throw new StaleSessionRefreshError('Session changed before access token refresh started.');
  }

  refreshPromise ??= window.auth
    // Refresh Token 在 Electron 主进程中，渲染进程只能请求“帮我刷新会话”。
    .refreshSession()
    .then((session) => {
      if (!applyRefreshedSession(session, expectedEpoch)) {
        throw new StaleSessionRefreshError('Session changed while access token was refreshing.');
      }

      return session;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function isApiErrorBody(value: unknown): value is { error: { message: string } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error?: { message?: unknown } }).error?.message === 'string'
  );
}
