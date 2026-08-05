import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer as consumeBuffer } from 'node:stream/consumers';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PhotoStatus, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { PhotoDto } from './dto/photo.dto';
import type { ListPhotosQueryDto } from './dto/list-photos-query.dto';
import type { PhotoPageDto } from './dto/photo-page.dto';
import { PhotoMetadataReader } from './photo-metadata.reader';
import { removeStoredObjects } from './photo-storage-cleanup.util';
import { buildOriginalObjectKey, getFileNameBase } from './photo-storage-key.util';
import { PhotoThumbnailGenerator } from './photo-thumbnail.generator';
import { PhotoUploadValidator, type UploadedPhotoFile } from './photo-upload.validator';

const THUMBNAIL_CACHE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const THUMBNAIL_CACHE_PREFIX = 'thumbnails';
const THUMBNAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const THUMBNAIL_CACHE_VERSION = 'v1';
const THUMBNAIL_FILE_NAME_SUFFIX = '.thumbnail.webp';

const photoSelect = {
  id: true,
  projectId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  originalObjectKey: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PhotoSelect;

type PhotoRecord = Prisma.PhotoGetPayload<{
  select: typeof photoSelect;
}>;

const photoOriginalSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  originalObjectKey: true,
  sizeBytes: true,
} satisfies Prisma.PhotoSelect;

export type PhotoOriginal = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  stream: Readable;
};

export type PhotoThumbnail = {
  fileName: string;
  mimeType: 'image/webp';
  sizeBytes: number;
  stream: Readable;
};

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly thumbnailBuilds = new Map<string, Promise<Buffer>>();
  private lastThumbnailCacheCleanupAt = 0;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StorageService)
    private readonly storageService: StorageService,
    @Inject(PhotoUploadValidator)
    private readonly uploadValidator: PhotoUploadValidator,
    @Inject(PhotoMetadataReader)
    private readonly metadataReader: PhotoMetadataReader,
    @Inject(PhotoThumbnailGenerator)
    private readonly thumbnailGenerator: PhotoThumbnailGenerator,
  ) {}

  async uploadPhoto(
    userId: string,
    projectId: string,
    file: UploadedPhotoFile | undefined,
  ): Promise<PhotoDto> {
    await this.ensureOwnedProject(userId, projectId);

    const validated = await this.uploadValidator.validate(file);
    const metadata = await this.metadataReader.readMetadata(file!.buffer);
    const photoId = randomUUID();

    const originalObjectKey = buildOriginalObjectKey(projectId, photoId, validated.fileName);

    const checksumSha256 = createHash('sha256').update(file!.buffer).digest('hex');

    try {
      await this.storageService.putObject(originalObjectKey, file!.buffer);
    } catch {
      await this.removeStoredObjects([originalObjectKey]);

      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '图片保存失败',
      );
    }

    try {
      const photo = await this.prisma.photo.create({
        data: {
          id: photoId,
          projectId,
          fileName: validated.fileName,
          relativePath: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          width: metadata.width,
          height: metadata.height,
          checksumSha256,
          originalObjectKey,
          status: PhotoStatus.UPLOADED,
        },
        select: photoSelect,
      });

      return this.toPhotoDto(photo);
    } catch (error) {
      await this.removeStoredObjects([originalObjectKey]);

      throw error;
    }
  }

  async listPhotos(
    userId: string,
    projectId: string,
    query: ListPhotosQueryDto,
  ): Promise<PhotoPageDto> {
    await this.ensureOwnedProject(userId, projectId);

    const photos = await this.prisma.photo.findMany({
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: photoSelect,
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      where: {
        projectId,
      },
    });

    const hasMore = photos.length > query.limit;
    const pageItems = hasMore ? photos.slice(0, query.limit) : photos;

    return {
      items: pageItems.map((photo) => this.toPhotoDto(photo)),
      nextCursor: hasMore ? pageItems.at(-1)!.id : null,
    };
  }

  async getOriginalPhoto(
    userId: string,
    projectId: string,
    photoId: string,
  ): Promise<PhotoOriginal> {
    const photo = await this.prisma.photo.findFirst({
      select: photoOriginalSelect,
      where: {
        id: photoId,
        project: {
          userId,
        },
        projectId,
      },
    });

    if (!photo) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PHOTO_NOT_FOUND', '照片不存在');
    }

    try {
      await this.storageService.statObject(photo.originalObjectKey);
      const stream = await this.storageService.getObject(photo.originalObjectKey);

      return {
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        stream,
      };
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '照片文件读取失败',
      );
    }
  }

  async getThumbnailPhoto(
    userId: string,
    projectId: string,
    photoId: string,
  ): Promise<PhotoThumbnail> {
    const photo = await this.prisma.photo.findFirst({
      select: photoOriginalSelect,
      where: {
        id: photoId,
        project: {
          userId,
        },
        projectId,
      },
    });

    if (!photo) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PHOTO_NOT_FOUND', '照片不存在');
    }

    await this.cleanupThumbnailCacheIfDue();

    const thumbnailObjectKey = buildThumbnailCacheObjectKey(
      projectId,
      photo.id,
      photo.originalObjectKey,
    );
    const cachedThumbnail = await this.getFreshCachedThumbnail(thumbnailObjectKey);

    if (cachedThumbnail) {
      return {
        fileName: `${getFileNameBase(photo.fileName)}${THUMBNAIL_FILE_NAME_SUFFIX}`,
        mimeType: 'image/webp',
        sizeBytes: cachedThumbnail.sizeBytes,
        stream: cachedThumbnail.stream,
      };
    }

    const thumbnailBuffer = await this.getOrCreateThumbnail(
      thumbnailObjectKey,
      photo.originalObjectKey,
    );

    return {
      fileName: `${getFileNameBase(photo.fileName)}${THUMBNAIL_FILE_NAME_SUFFIX}`,
      mimeType: 'image/webp',
      sizeBytes: thumbnailBuffer.byteLength,
      stream: Readable.from(thumbnailBuffer),
    };
  }

  private async getFreshCachedThumbnail(
    objectKey: string,
  ): Promise<{ sizeBytes: number; stream: Readable } | null> {
    try {
      const objectStat = await this.storageService.statObject(objectKey);

      if (Date.now() - objectStat.lastModified.getTime() >= THUMBNAIL_CACHE_TTL_MS) {
        return null;
      }

      return {
        sizeBytes: objectStat.size,
        stream: await this.storageService.getObject(objectKey),
      };
    } catch {
      return null;
    }
  }

  private getOrCreateThumbnail(objectKey: string, originalObjectKey: string): Promise<Buffer> {
    const existingBuild = this.thumbnailBuilds.get(objectKey);

    if (existingBuild) {
      return existingBuild;
    }

    const build = this.generateAndCacheThumbnail(objectKey, originalObjectKey).finally(() => {
      this.thumbnailBuilds.delete(objectKey);
    });
    this.thumbnailBuilds.set(objectKey, build);

    return build;
  }

  private async generateAndCacheThumbnail(
    thumbnailObjectKey: string,
    originalObjectKey: string,
  ): Promise<Buffer> {
    let originalBuffer: Buffer;

    try {
      const originalStream = await this.storageService.getObject(originalObjectKey);
      originalBuffer = await consumeBuffer(originalStream);
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '照片文件读取失败',
      );
    }

    const thumbnailBuffer = await this.thumbnailGenerator.generate(originalBuffer);

    try {
      await this.storageService.putObject(thumbnailObjectKey, thumbnailBuffer);
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '缩略图缓存写入失败',
      );
    }

    return thumbnailBuffer;
  }

  private async cleanupThumbnailCacheIfDue(): Promise<void> {
    const now = Date.now();

    if (now - this.lastThumbnailCacheCleanupAt < THUMBNAIL_CACHE_CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastThumbnailCacheCleanupAt = now;

    try {
      const removedCount = await this.storageService.removeObjectsOlderThan(
        THUMBNAIL_CACHE_PREFIX,
        new Date(now - THUMBNAIL_CACHE_TTL_MS),
      );

      if (removedCount > 0) {
        this.logger.log(`Removed ${removedCount} expired thumbnail cache object(s).`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean expired thumbnail cache objects.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async ensureOwnedProject(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      select: {
        id: true,
      },
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PROJECT_NOT_FOUND', '图库项目不存在');
    }
  }

  private async removeStoredObjects(objectKeys: string[]): Promise<void> {
    await removeStoredObjects(this.storageService, objectKeys, this.logger);
  }

  private toPhotoDto(photo: PhotoRecord): PhotoDto {
    return {
      id: photo.id,
      projectId: photo.projectId,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      width: photo.width,
      height: photo.height,
      originalUrl: buildPublicUrl(photo.originalObjectKey),
      status: photo.status,
      thumbnailUrl: buildThumbnailApiUrl(photo.projectId, photo.id),
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }
}

function buildPublicUrl(objectKey: string): string {
  const encodedObjectKey = objectKey.split('/').map(encodeURIComponent).join('/');

  return `/public/${encodedObjectKey}`;
}

function buildThumbnailApiUrl(projectId: string, photoId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/photos/${encodeURIComponent(photoId)}/thumbnail`;
}

function buildThumbnailCacheObjectKey(
  projectId: string,
  photoId: string,
  originalObjectKey: string,
): string {
  const sourceKey = createHash('sha256').update(originalObjectKey).digest('hex').slice(0, 12);

  return `${THUMBNAIL_CACHE_PREFIX}/${projectId}/${photoId}.${sourceKey}.${THUMBNAIL_CACHE_VERSION}.webp`;
}
