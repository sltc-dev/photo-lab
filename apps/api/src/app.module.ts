import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { AppEnv } from './config/env';
import { validateEnv } from './config/env';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StorageModule } from './modules/storage/storage.module';
import { PhotosModule } from './modules/photos/photos.module';
import { MaterialModule } from './modules/material/material.module';

@Module({
  imports: [
    // 启动时读取并校验环境变量；isGlobal 让其他模块无需重复导入即可读取配置。
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
    // 全局默认限流来自环境变量，认证接口会在 Controller 上覆盖成更严格的额度。
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => [
        {
          limit: configService.getOrThrow('THROTTLE_LIMIT'),
          ttl: configService.getOrThrow('THROTTLE_TTL_MS'),
        },
      ],
    }),
    AuthModule,
    HealthModule,
    ProjectsModule,
    StorageModule,
    PhotosModule,
    MaterialModule,
  ],
  providers: [
    // APP_FILTER 会让统一错误格式应用到所有 Controller。
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // APP_GUARD 会让限流检查先于所有 Controller 方法执行。
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
// AppModule 只负责组装全局能力和业务模块，不直接放业务代码。
export class AppModule {}
