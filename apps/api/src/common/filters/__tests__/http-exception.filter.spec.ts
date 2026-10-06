import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../errors/app.exception';
import { HttpExceptionFilter } from '../http-exception.filter';

function filter(exception: HttpException) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return response;
}

describe('HTTP exception filter', () => {
  it.each([
    new ThrottlerException(),
    new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
  ])('normalizes framework rate limits into a localized business error', (exception) => {
    const response = filter(exception);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后重试。',
        details: null,
      },
    });
  });

  it('preserves explicit business messages and details', () => {
    const body = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '今日申请次数已达上限。',
      details: { limit: 50 },
    };
    const response = filter(
      new AppException(429, 'RATE_LIMIT_EXCEEDED', body.message, body.details),
    );
    expect(response.json).toHaveBeenCalledWith({ error: body });
  });

  it('preserves other HTTP errors', () => {
    const response = filter(new HttpException({ message: 'Invalid input' }, 400));
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid input',
        details: { message: 'Invalid input' },
      },
    });
  });
});
