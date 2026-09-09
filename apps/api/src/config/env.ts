import { z } from 'zod';

/** 校验 15m、30d 这类时间字符串，并限制最大有效期。 */
const durationSchema = (maxMs: number) =>
  z
    .string()
    .regex(/^\d+(ms|s|m|h|d)$/, 'must be a duration such as 15m or 30d')
    .refine((value) => {
      try {
        const duration = parseDurationToMs(value);
        return Number.isSafeInteger(duration) && duration > 0 && duration <= maxMs;
      } catch {
        return false;
      }
    }, 'duration is outside the supported range');

const developmentSecrets = new Set(['dev-access-secret-change-me', 'dev-refresh-secret-change-me']);

const envSchema = z
  .object({
    ACCESS_TOKEN_TTL: durationSchema(24 * 60 * 60 * 1000).default('15m'),
    CORS_ORIGINS: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    MINIO_ACCESS_KEY: z.string().optional(),
    MINIO_ENDPOINT: z.string().optional(),
    MINIO_SECRET_KEY: z.string().optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PHOTO_STORAGE_ROOT: z.string().trim().min(1).default('../../public/photo-lab'),
    PHOTO_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024)
      .default(25 * 1024 * 1024),
    PORT: z.coerce.number().int().positive().default(3000),
    REDIS_URL: z.string().optional(),
    REFRESH_TOKEN_TTL: durationSchema(366 * 24 * 60 * 60 * 1000).default('30d'),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  })
  .superRefine((env, context) => {
    // 开发环境允许使用本地默认值；生产环境必须显式收紧来源和 Secret。
    if (env.NODE_ENV !== 'production') {
      return;
    }

    if (!env.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'is required in production',
        path: ['CORS_ORIGINS'],
      });
    }

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (developmentSecrets.has(env[key])) {
        context.addIssue({
          code: 'custom',
          message: 'must not use a development default in production',
          path: [key],
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  // 在应用启动阶段一次性失败，比处理第一个请求时才发现缺配置更容易排查。
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid environment variables: ${details}`);
  }

  return parsed.data;
}

export function parseDurationToMs(value: string): number {
  // Token 过期时间最终要参与 Date.now() 计算，所以统一换算成毫秒。
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as 'd' | 'h' | 'm' | 'ms' | 's';
  const multipliers: Record<typeof unit, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    ms: 1,
    s: 1000,
  };

  return amount * multipliers[unit];
}
