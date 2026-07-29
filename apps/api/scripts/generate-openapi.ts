import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';

// 生成接口文档只需要启动 Nest 容器，不需要真实数据库和生产 Secret。
process.env.ACCESS_TOKEN_TTL ??= '15m';
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.JWT_ACCESS_SECRET ??= 'openapi-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'openapi-refresh-secret';
process.env.NODE_ENV ??= 'development';
process.env.PHOTO_STORAGE_ROOT ??= '../../data/photo-lab';
process.env.PORT ??= '3000';
process.env.REFRESH_TOKEN_TTL ??= '30d';
process.env.SKIP_PRISMA_CONNECT = 'true';

const outputPath = resolve(process.cwd(), '../../packages/api-contract/openapi.json');

async function generateOpenApi(): Promise<void> {
  // 动态导入发生在上面的占位环境变量设置之后，确保 AppModule 校验能通过。
  const { AppModule } = await import('../src/app.module.js');
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  const config = new DocumentBuilder()
    .setTitle('Photo Lab API')
    .setDescription('Generated OpenAPI contract for Photo Lab clients.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // 生成客户端时使用方法名作为稳定 operationId，例如 login、refresh。
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });

  assertUniqueOperationIds(document);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

function assertUniqueOperationIds(document: { paths?: unknown }): void {
  // operationId 重复会让生成的 SDK 函数互相覆盖，因此在写文件前主动失败。
  const seen = new Set<string>();

  if (!isRecord(document.paths)) {
    return;
  }

  for (const pathItem of Object.values(document.paths)) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      if (!isOperationObject(operation)) {
        continue;
      }

      if (seen.has(operation.operationId)) {
        throw new Error(`Duplicate OpenAPI operationId: ${operation.operationId}`);
      }

      seen.add(operation.operationId);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOperationObject(value: unknown): value is { operationId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operationId' in value &&
    typeof (value as { operationId?: unknown }).operationId === 'string'
  );
}
