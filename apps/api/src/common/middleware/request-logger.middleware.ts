import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const logger = new Logger('HTTP');
const maxLoggedBodyLength = 2_000;

export function requestLogger(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();

  // 等响应真正结束再记录，才能拿到最终状态码、响应大小和完整耗时。
  response.on('finish', () => {
    logger.log(
      [
        'event=http_request',
        `method=${request.method}`,
        `path=${request.path}`,
        `status=${response.statusCode}`,
        `durationMs=${Date.now() - startedAt}`,
        `httpVersion=${request.httpVersion}`,
        `ip=${request.ip}`,
        `userAgent=${JSON.stringify(request.get('user-agent') ?? 'unknown')}`,
        `requestBytes=${request.get('content-length') ?? 'unknown'}`,
        `responseBytes=${String(response.getHeader('content-length') ?? 'unknown')}`,
        `userId=${request.user?.id ?? 'anonymous'}`,
        `requestId=${request.requestId ?? 'unknown'}`,
        `body=${formatBody(request.body)}`,
      ].join('\n  '),
    );
  });

  next();
}

function formatBody(body: unknown): string {
  if (body === undefined) {
    return 'none';
  }

  // 先脱敏再序列化，确保原始密码和 Token 从未进入日志字符串。
  const serialized = JSON.stringify(redactSensitiveValues(body));

  if (serialized.length <= maxLoggedBodyLength) {
    return serialized;
  }

  return `${serialized.slice(0, maxLoggedBodyLength)}...[truncated]`;
}

function redactSensitiveValues(value: unknown): unknown {
  // 递归处理数组和对象，嵌套字段中的 password/token 也不会漏掉。
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveKey(key) ? '[REDACTED]' : redactSensitiveValues(child),
    ]),
  );
}

function isSensitiveKey(key: string): boolean {
  // 大小写不影响判断，例如 accessToken、ACCESS_TOKEN 都会命中 token。
  const normalized = key.toLowerCase();

  return (
    normalized.includes('password') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized === 'authorization' ||
    normalized === 'cookie'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
