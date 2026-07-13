import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
/**
 * 把 PrismaClient 交给 Nest 的依赖注入系统管理。
 * 业务 Service 注入这个类后，就能调用 prisma.user、prisma.refreshToken 等数据库方法。
 */
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // 生成 OpenAPI 时只需要读取装饰器，不应该真的连接数据库。
    if (process.env.SKIP_PRISMA_CONNECT === 'true') {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    // 应用退出时主动断开连接，避免开发热重启留下旧连接。
    if (process.env.SKIP_PRISMA_CONNECT === 'true') {
      return;
    }

    await this.$disconnect();
  }
}
