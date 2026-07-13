import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_REFRESH_TOKEN_INVALID'
  | 'AUTH_TOKEN_EXPIRED'
  | 'BAD_REQUEST'
  | 'HTTP_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'USER_EMAIL_ALREADY_EXISTS'
  | 'USER_NOT_FOUND'
  | 'VALIDATION_FAILED';

export const ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
  'BAD_REQUEST',
  'HTTP_ERROR',
  'INTERNAL_SERVER_ERROR',
  'NOT_FOUND',
  'RATE_LIMIT_EXCEEDED',
  'USER_EMAIL_ALREADY_EXISTS',
  'USER_NOT_FOUND',
  'VALIDATION_FAILED',
] as const satisfies readonly ErrorCode[];

export type ErrorBody = {
  code: ErrorCode;
  details: unknown;
  message: string;
};

export class AppException extends HttpException {
  /** 创建一个同时包含 HTTP 状态码和稳定业务错误码的异常。 */
  constructor(status: HttpStatus, code: ErrorCode, message: string, details: unknown = null) {
    super({ code, details, message }, status);
  }
}

export function isErrorBody(value: unknown): value is ErrorBody {
  // 运行时类型保护：异常过滤器据此判断响应是否已经是项目标准格式。
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof ErrorBody, unknown>>;

  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    'details' in candidate
  );
}
