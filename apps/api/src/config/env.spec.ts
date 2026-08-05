import { describe, expect, it } from 'vitest';
import { parseDurationToMs, validateEnv } from './env';

const baseEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'test-access-secret-123',
  JWT_REFRESH_SECRET: 'test-refresh-secret-123',
  PHOTO_STORAGE_ROOT: '/tmp/photo-lab-test',
};

describe('environment validation', () => {
  it('parses supported duration values', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
    expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('rejects malformed and excessive token TTL values at startup', () => {
    expect(() => validateEnv({ ...baseEnv, ACCESS_TOKEN_TTL: 'not-a-duration' })).toThrow();
    expect(() => validateEnv({ ...baseEnv, ACCESS_TOKEN_TTL: '25h' })).toThrow();
    expect(() => validateEnv({ ...baseEnv, REFRESH_TOKEN_TTL: '367d' })).toThrow();
  });

  it('rejects missing CORS configuration and development secrets in production', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
        NODE_ENV: 'production',
      }),
    ).toThrow(/CORS_ORIGINS.*JWT_ACCESS_SECRET.*JWT_REFRESH_SECRET/);
  });

  it('rejects an empty photo storage root at startup', () => {
    expect(() => validateEnv({ ...baseEnv, PHOTO_STORAGE_ROOT: '  ' })).toThrow(
      /PHOTO_STORAGE_ROOT/,
    );
  });
});
