import { ExecutionContext, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import type { AppEnv } from '../../../config/env';
import { NotificationPublishGuard } from '../notification-publish.guard';

const secret = 'test-notification-publish-secret-123456';

function createGuard(suppliedSecret: string | undefined) {
  const config = {
    getOrThrow: () => secret,
  } as unknown as ConfigService<AppEnv, true>;
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        header: () => suppliedSecret,
      }),
    }),
  } as unknown as ExecutionContext;

  return { context, guard: new NotificationPublishGuard(config) };
}

describe('NotificationPublishGuard', () => {
  it('accepts the configured publish secret', () => {
    const { context, guard } = createGuard(secret);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects missing or incorrect secrets', () => {
    for (const suppliedSecret of [undefined, 'incorrect-secret']) {
      const { context, guard } = createGuard(suppliedSecret);
      try {
        guard.canActivate(context);
        throw new Error('Expected guard rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    }
  });
});
