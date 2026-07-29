import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
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

  private resolveSafe(objectKey: string): string {
    const target = resolve(this.root, objectKey);

    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('Storage object path escapes PHOTO_STORAGE_ROOT');
    }

    return target;
  }
}
