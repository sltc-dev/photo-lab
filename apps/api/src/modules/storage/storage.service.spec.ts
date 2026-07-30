import { mkdtemp, readFile, readdir, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../config/env';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let sandbox: string;
  let storageRoot: string;
  let service: StorageService;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'photo-lab-storage-'));
    storageRoot = join(sandbox, 'objects');
    const configService = {
      getOrThrow: vi.fn(() => storageRoot),
    } as unknown as ConfigService<AppEnv, true>;
    service = new StorageService(configService);
  });

  afterEach(async () => {
    await rm(sandbox, { force: true, recursive: true });
  });

  it('creates the configured storage root during application bootstrap', async () => {
    await service.onApplicationBootstrap();

    await expect(readdir(storageRoot)).resolves.toEqual([]);
  });

  it('writes a buffer atomically and exposes its file information', async () => {
    const objectKey = 'projects/project-1/photos/photo-1--holiday.jpg';
    const body = Buffer.from('photo');

    await service.putObject(objectKey, body);

    await expect(readFile(join(storageRoot, objectKey))).resolves.toEqual(body);
    await expect(service.statObject(objectKey)).resolves.toEqual({
      lastModified: expect.any(Date),
      size: body.byteLength,
    });
    await expect(readdir(join(storageRoot, dirnameOf(objectKey)))).resolves.toEqual([
      'photo-1--holiday.jpg',
    ]);
  });

  it('supports streaming writes and reads', async () => {
    const objectKey = 'projects/project-1/photos/photo-2/thumbnail.webp';
    await service.putObject(objectKey, Readable.from(['thumb', 'nail']));

    const stream = await service.getObject(objectKey);

    await expect(readStream(stream)).resolves.toEqual(Buffer.from('thumbnail'));
  });

  it('removes an object without failing when it is already absent', async () => {
    const objectKey = 'projects/project-1/photos/photo-3--旅行照片.png';
    await service.putObject(objectKey, Buffer.from('photo'));

    await expect(service.removeObject(objectKey)).resolves.toBeUndefined();
    await expect(service.removeObject(objectKey)).resolves.toBeUndefined();
    await expect(readFile(join(storageRoot, objectKey))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes cached objects older than the supplied cutoff', async () => {
    const expiredObjectKey = 'thumbnails/project-1/expired.v1.webp';
    const freshObjectKey = 'thumbnails/project-1/fresh.v1.webp';
    await service.putObject(expiredObjectKey, Buffer.from('expired'));
    await service.putObject(freshObjectKey, Buffer.from('fresh'));
    await utimes(
      join(storageRoot, expiredObjectKey),
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-01T00:00:00.000Z'),
    );

    await expect(
      service.removeObjectsOlderThan('thumbnails', new Date('2026-07-08T00:00:00.000Z')),
    ).resolves.toBe(1);
    await expect(readFile(join(storageRoot, expiredObjectKey))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(join(storageRoot, freshObjectKey))).resolves.toEqual(
      Buffer.from('fresh'),
    );
  });

  it('rejects object keys that escape the configured root', async () => {
    await expect(service.putObject('../outside.jpg', Buffer.from('photo'))).rejects.toThrow(
      'escapes PHOTO_STORAGE_ROOT',
    );
    await expect(service.getObject('/etc/passwd')).rejects.toThrow('escapes PHOTO_STORAGE_ROOT');
  });
});

function dirnameOf(objectKey: string): string {
  return objectKey.slice(0, objectKey.lastIndexOf('/'));
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
