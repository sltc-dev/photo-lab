import 'reflect-metadata';
import type { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PhotoMetadataReader } from '../src/modules/photos/photo-metadata.reader';
import { StorageService } from '../src/modules/storage/storage.service';
import { PrismaService } from '../src/prisma/prisma.service';

const logger = new Logger('PhotoDimensionsBackfill');

async function backfillPhotoDimensions(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'log', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const storage = app.get(StorageService);
    const metadataReader = app.get(PhotoMetadataReader);
    const photos = await prisma.photo.findMany({
      select: {
        id: true,
        originalObjectKey: true,
      },
    });
    let updated = 0;
    let failed = 0;

    for (const photo of photos) {
      try {
        const stream = await storage.getObject(photo.originalObjectKey);
        const buffer = await readStream(stream);
        const { height, width } = await metadataReader.readMetadata(buffer);

        await prisma.photo.update({
          data: {
            height,
            width,
          },
          where: {
            id: photo.id,
          },
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        logger.warn(
          `无法回填照片尺寸 photoId=${photo.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    logger.log(`照片尺寸回填完成：扫描 ${photos.length} 张，更新 ${updated} 张，失败 ${failed} 张`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks);
}

backfillPhotoDimensions().catch((error: unknown) => {
  logger.error(error);
  process.exitCode = 1;
});
