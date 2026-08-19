import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });
loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });

type NotificationType = 'SYSTEM' | 'VERSION_UPGRADE';
type NotificationLevel = 'INFO' | 'WARNING' | 'CRITICAL';

type PublishInput = {
  content: string;
  expiresAt?: string;
  level: NotificationLevel;
  publishedAt?: string;
  summary: string;
  targetVersion?: string;
  title: string;
  type: NotificationType;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const secret =
    process.env.NOTIFICATION_PUBLISH_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'dev-notification-publish-secret-change-me');
  const apiBaseUrl =
    process.env.NOTIFICATION_API_URL ?? process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

  if (!secret) {
    throw new Error('NOTIFICATION_PUBLISH_SECRET is required.');
  }

  const input = await buildInput(args);
  const response = await fetch(new URL('/internal/notifications', apiBaseUrl), {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
      'x-notification-publish-secret': secret,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notification publish failed (${response.status}): ${body}`);
  }

  const notification = (await response.json()) as {
    id: string;
    publishedAt: string;
    title: string;
    type: string;
  };

  console.log(
    JSON.stringify(
      {
        id: notification.id,
        publishedAt: notification.publishedAt,
        title: notification.title,
        type: notification.type,
      },
      null,
      2,
    ),
  );
}

async function buildInput(args: Map<string, string>): Promise<PublishInput> {
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

  const type = (args.get('type') ?? 'SYSTEM') as NotificationType;
  const level = (args.get('level') ?? 'INFO') as NotificationLevel;

  if (!['SYSTEM', 'VERSION_UPGRADE'].includes(type)) {
    throw new Error('--type must be SYSTEM or VERSION_UPGRADE.');
  }
  if (!['INFO', 'WARNING', 'CRITICAL'].includes(level)) {
    throw new Error('--level must be INFO, WARNING, or CRITICAL.');
  }

  const input: PublishInput = {
    content: content.trim(),
    level,
    summary,
    title,
    type,
  };

  const expiresAt = args.get('expires-at');
  const publishedAt = args.get('published-at');
  const targetVersion = args.get('target-version');
  if (expiresAt) input.expiresAt = expiresAt;
  if (publishedAt) input.publishedAt = publishedAt;
  if (targetVersion) input.targetVersion = targetVersion;

  return input;
}

function parseArgs(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const values = argv.filter((argument) => argument !== '--');

  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];

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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
