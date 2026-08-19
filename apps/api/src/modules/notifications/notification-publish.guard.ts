import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';
import type { AppEnv } from '../../config/env';

@Injectable()
export class NotificationPublishGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const suppliedSecret = request.header('x-notification-publish-secret');
    const expectedSecret = this.configService.getOrThrow('NOTIFICATION_PUBLISH_SECRET');

    if (!suppliedSecret || !secretsMatch(suppliedSecret, expectedSecret)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'NOTIFICATION_PUBLISH_FORBIDDEN',
        '通知发布凭据无效',
      );
    }

    return true;
  }
}

function secretsMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
