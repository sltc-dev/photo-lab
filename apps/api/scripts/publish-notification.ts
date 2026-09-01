import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NotificationLevel, NotificationType } from '@prisma/client';
import { NotificationCoreModule } from '../src/modules/notifications/notification-core.module';
import type { PublishNotificationDto } from '../src/modules/notifications/dto/publish-notification.dto';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: ['../../.env', '.env'], isGlobal: true }),
    NotificationCoreModule,
  ],
})
class NotificationCliModule {}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((argument) => argument !== '--');

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  // 参数无效时不启动 Nest，也不创建数据库连接。
  const input = await buildInput(parseArgs(argv));
  const app = await NestFactory.createApplicationContext(NotificationCliModule, {
    logger: ['error'],
  });

  try {
    const service = app.get(NotificationsService);
    const notification = await service.publishNotification(input);

    console.log(
      JSON.stringify(
        {
          id: notification.id,
          publishedAt: notification.publishedAt.toISOString(),
          title: notification.title,
          type: notification.type,
        },
        null,
        2,
      ),
    );
  } finally {
    // 触发 Prisma 的关闭钩子，让一次性命令执行后立即退出。
    await app.close();
  }
}

export async function buildInput(args: Map<string, string>): Promise<PublishNotificationDto> {
  const title = required(args, 'title');
  const summary = required(args, 'summary');
  const contentValue = args.get('content');
  const contentFile = args.get('content-file');

  if (contentValue && contentFile) {
    throw new Error('Use either --content or --content-file, not both.');
  }

  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  const content = contentFile
    ? await readFile(resolve(invocationDirectory, contentFile), 'utf8')
    : contentValue;

  if (!content?.trim()) {
    throw new Error('One of --content or --content-file is required.');
  }

  const type = args.get('type') ?? NotificationType.SYSTEM;
  const level = args.get('level') ?? NotificationLevel.INFO;

  if (!Object.values(NotificationType).includes(type as NotificationType)) {
    throw new Error('--type must be SYSTEM or VERSION_UPGRADE.');
  }
  if (!Object.values(NotificationLevel).includes(level as NotificationLevel)) {
    throw new Error('--level must be INFO, WARNING, or CRITICAL.');
  }

  const input: PublishNotificationDto = {
    content: content.trim(),
    level: level as NotificationLevel,
    summary,
    title,
    type: type as NotificationType,
  };

  const expiresAt = args.get('expires-at');
  const publishedAt = args.get('published-at');
  const targetVersion = args.get('target-version');
  if (expiresAt) input.expiresAt = expiresAt;
  if (publishedAt) input.publishedAt = publishedAt;
  if (targetVersion) input.targetVersion = targetVersion;

  return input;
}

export function parseArgs(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}. Expected --name value.`);
    }

    result.set(key.slice(2), value);
  }

  return result;
}

function required(args: Map<string, string>, name: string): string {
  const value = args.get(name)?.trim();

  if (!value) {
    throw new Error(`--${name} is required.`);
  }

  return value;
}

function printHelp(): void {
  console.log(`Publish a Photo Lab notification directly through NestJS.

Usage:
  pnpm notification:publish -- --title <text> --summary <text> --content <text> [options]

Required:
  --title <text>            Notification title
  --summary <text>          Short list summary
  --content <text>          Notification body
  --content-file <path>     Read the body from a file instead of --content

Options:
  --type <value>            SYSTEM (default) or VERSION_UPGRADE
  --level <value>           INFO (default), WARNING, or CRITICAL
  --target-version <value>  Version associated with an upgrade notification
  --published-at <ISO8601>  Publication time (default: now)
  --expires-at <ISO8601>    Expiration time
  -h, --help                Show this help
`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
