import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// 先读仓库根配置；API 目录下的 .env 若存在，则用于本地覆盖。
loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '.env'), override: true });

export default defineConfig({
  // Prisma CLI（migrate、studio 等）从这里取得数据库连接和 schema 位置。
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
});
