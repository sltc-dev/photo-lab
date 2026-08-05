import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env';

export type StorageObjectStat = {
  lastModified: Date;
  size: number;
};

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly root: string;

  constructor(@Inject(ConfigService) configService: ConfigService<AppEnv, true>) {
    this.root = resolve(configService.getOrThrow('PHOTO_STORAGE_ROOT'));
  }

  async onApplicationBootstrap(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async getObject(objectKey: string): Promise<Readable> {
    return createReadStream(this.resolveSafe(objectKey));
  }

  async putObject(objectKey: string, body: Buffer | Readable): Promise<void> {
    const target = this.resolveSafe(objectKey);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(dirname(target), { recursive: true });

    try {
      if (Buffer.isBuffer(body)) {
        await writeFile(temporary, body, { flag: 'wx' });
      } else {
        await pipeline(body, createWriteStream(temporary, { flags: 'wx' }));
      }

      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async removeObject(objectKey: string): Promise<void> {
    await rm(this.resolveSafe(objectKey), { force: true });
  }

  async statObject(objectKey: string): Promise<StorageObjectStat> {
    const result = await stat(this.resolveSafe(objectKey));

    return {
      lastModified: result.mtime,
      size: result.size,
    };
  }

  async removeObjectsOlderThan(prefix: string, cutoff: Date): Promise<number> {
    const directory = this.resolveSafe(prefix);

    try {
      return await removeFilesOlderThan(directory, cutoff);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return 0;
      }

      throw error;
    }
  }

  private resolveSafe(objectKey: string): string {
    const target = resolve(this.root, objectKey);

    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('Storage object path escapes PHOTO_STORAGE_ROOT');
    }

    return target;
  }
}

async function removeFilesOlderThan(directory: string, cutoff: Date): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      removedCount += await removeFilesOlderThan(entryPath, cutoff);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const entryStat = await stat(entryPath);

    if (entryStat.mtime.getTime() < cutoff.getTime()) {
      await rm(entryPath, { force: true });
      removedCount += 1;
    }
  }

  return removedCount;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
