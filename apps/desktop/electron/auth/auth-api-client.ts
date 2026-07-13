import { z } from 'zod';

export const AUTH_API_REQUEST_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  schema: z.ZodType<TResponse>,
): Promise<TResponse> {
  // 认证请求由主进程发出，Refresh Token 不需要穿过 React 渲染进程。
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.timeout(AUTH_API_REQUEST_TIMEOUT_MS),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    // 把后端统一错误格式转换成带 HTTP 状态码的 Error，供 IPC 上层判断。
    throw new ApiRequestError(
      getErrorMessage(payload) ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  // 即使 HTTP 200，也要验证后端响应形状，避免错误数据进入 TokenStore。
  return schema.parse(payload);
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  // 只有凭证本身无效时才清本机 Token；网络超时不应把用户直接登出。
  return error instanceof ApiRequestError && (error.status === 400 || error.status === 401);
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (response.ok) {
      throw error;
    }

    return null;
  }
}

function getErrorMessage(payload: unknown): string | null {
  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : null;
}

function getApiBaseUrl(): string {
  return process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
}

const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});
