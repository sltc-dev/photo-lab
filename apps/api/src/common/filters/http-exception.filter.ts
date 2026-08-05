import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type ErrorCode, isErrorBody } from '../errors/app.exception';

type RequestWithId = Request & {
  requestId?: string;
};

@Catch()
/**
 * 所有 HTTP 异常的最后出口。
 * 无论异常来自 DTO、Guard、Service 还是框架，客户端最终都收到 { error: ... }。
 */
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    // Nest 的 HttpException 自带状态码；未知错误一律按 500 处理。
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = this.getErrorBody(exception);

    if (status >= 500) {
      // 只在服务端错误时记录堆栈；可预期的 4xx 不需要污染错误日志。
      this.logger.error(
        `requestId=${request.requestId ?? 'unknown'} ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      error: body,
    });
  }

  private getErrorBody(exception: unknown): {
    code: string;
    details: unknown;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (isErrorBody(response)) {
        // AppException 已经是项目标准格式，直接透传内部 error body。
        return response;
      }

      if (typeof response === 'object' && response !== null && 'message' in response) {
        // ValidationPipe 等 Nest 内置异常常返回对象，这里把它们适配成统一结构。
        const message = (response as { message?: unknown }).message;

        return {
          code: this.getCodeForStatus(exception.getStatus()),
          details: response,
          message: Array.isArray(message) ? message.join(', ') : String(message),
        };
      }

      return {
        code: 'HTTP_ERROR',
        details: null,
        message: typeof response === 'string' ? response : exception.message,
      };
    }

    // 未知异常不把内部错误细节发给客户端，避免泄露堆栈或数据库信息。
    return {
      code: 'INTERNAL_SERVER_ERROR',
      details: null,
      message: '服务器内部错误',
    };
  }

  private getCodeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_TOKEN_EXPIRED';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PHOTO_FILE_TOO_LARGE';
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return 'PHOTO_UNSUPPORTED_TYPE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
    }
  }
}
