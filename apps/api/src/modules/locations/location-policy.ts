import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { nearbyFriendsConfig, type NearbyFriendsConfig } from '../../config/nearby-friends.config';

export function normalizeCapturedAt(
  value: string,
  now: Date,
  config: NearbyFriendsConfig = nearbyFriendsConfig,
): Date {
  const capturedAt = new Date(value);

  if (
    !Number.isFinite(capturedAt.getTime()) ||
    capturedAt.getTime() > now.getTime() + config.location.maxClockSkewMs
  ) {
    throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', '定位时间无效，请重新获取位置。');
  }

  if (capturedAt.getTime() <= now.getTime() - config.location.ttlMs) {
    throw new AppException(HttpStatus.CONFLICT, 'LOCATION_STALE', '请重新获取当前位置。');
  }

  return new Date(Math.min(capturedAt.getTime(), now.getTime()));
}

export function canonicalUserPair(
  first: string,
  second: string,
): { userLowId: string; userHighId: string } {
  return first < second
    ? { userLowId: first, userHighId: second }
    : { userLowId: second, userHighId: first };
}
