import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { HttpStatus, Logger, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env';
import { AppException } from './common/errors/app.exception';
import { requestLogger } from './common/middleware/request-logger.middleware';

type RequestWithId = Request & {
  requestId?: string;
};

/**
 * 后端的启动入口。
 *
 * 这里不处理具体业务，而是把所有请求都会经过的能力装到 Nest 应用上：
 * 安全响应头、请求 ID、访问日志、CORS、DTO 校验，最后再监听端口。
 */
async function bootstrap(): Promise<void> {
  // AppModule 是整个后端的“总装配清单”，Nest 会从它开始创建各个模块和服务。
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppEnv, true>);
  const logger = new Logger('Bootstrap');
  const nodeEnv = config.getOrThrow('NODE_ENV');

  app.enableShutdownHooks();
  app.use(helmet());

  // 将照片存储目录映射为 /public/* 静态资源，供浏览器直接访问上传后的照片。
  app.useStaticAssets(resolve(config.getOrThrow('PHOTO_STORAGE_ROOT')), {
    prefix: '/public/',
    setHeaders: (response) => {
      // 照片使用唯一地址，允许浏览器或 CDN 长期缓存，减少重复下载。
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      // 允许其他域名通过 img 等资源标签加载照片；这不等同于开放 fetch 的 CORS 权限。
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // 每个请求都带一个 requestId，响应头和服务端日志可以据此对应到同一次请求。
  // 客户端传来的 ID 只有格式安全时才复用，否则由后端生成新的 UUID。
  app.use((request: RequestWithId, response: Response, next: NextFunction) => {
    const requestId = normalizeRequestId(request.header('x-request-id')) ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });

  // requestLogger 在响应结束时记录状态码和耗时，注册顺序保证它能读到上面的 requestId。
  app.use(requestLogger);

  const allowedOrigins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }), nodeEnv);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // curl、Electron 主进程等服务端请求可能没有 Origin；浏览器请求则必须在白名单中。
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin denied: ${origin}`));
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // DTO 没声明的额外字段直接报错，避免客户端偷偷夹带后端不认识的数据。
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', '请求参数校验失败', {
          fields: nodeEnv === 'production' ? undefined : flattenValidationErrors(errors),
        }),
      // 把普通 JSON 转成 DTO 实例，这样 @Transform 等运行时装饰器才能执行。
      transform: true,
      // 只保留带校验装饰器的 DTO 字段。
      whitelist: true,
    }),
  );

  const port = config.getOrThrow('PORT');
  await app.listen(port);

  logger.log(`API started in ${nodeEnv} mode on port ${port}`);
}

void bootstrap();

function parseCorsOrigins(value: string | undefined, nodeEnv: AppEnv['NODE_ENV']): string[] {
  // 生产环境不允许默默使用本地开发来源，否则部署后可能产生错误的跨域边界。
  if (nodeEnv === 'production' && !value) {
    throw new Error('CORS_ORIGINS must be configured in production.');
  }

  return (value ?? 'http://localhost:5173,http://127.0.0.1:5173,file://')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeRequestId(value: string | undefined): string | null {
  // 限制长度和字符集，避免恶意请求把换行等内容注入日志或响应头。
  if (!value || value.length > 80 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    return null;
  }

  return value;
}

function flattenValidationErrors(errors: ValidationError[]): Record<string, string[]> {
  // class-validator 的错误是树形结构；前端表单更适合按“字段路径 -> 错误列表”读取。
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    collectValidationError(error, error.property, result);
  }

  return result;
}

function collectValidationError(
  error: ValidationError,
  path: string,
  result: Record<string, string[]>,
): void {
  if (error.constraints) {
    result[path] = Object.values(error.constraints);
  }

  for (const child of error.children ?? []) {
    collectValidationError(child, `${path}.${child.property}`, result);
  }
}
