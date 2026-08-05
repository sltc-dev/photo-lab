import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PhotoStatus, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { PhotoDto } from './dto/photo.dto';
import type { ListPhotosQueryDto } from './dto/list-photos-query.dto';
import type { PhotoPageDto } from './dto/photo-page.dto';
import { PhotoMetadataReader } from './photo-metadata.reader';
import { PhotoThumbnailGenerator } from './photo-thumbnail.generator';
import { PhotoUploadValidator, type UploadedPhotoFile } from './photo-upload.validator';

const MAX_STORAGE_FILE_NAME_BYTES = 255;
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
  thumbnailObjectKey: true,
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

    const validated = this.uploadValidator.validate(file);
    const metadata = await this.metadataReader.readMetadata(file!.buffer);
    const thumbnailBuffer = await this.thumbnailGenerator.generate(file!.buffer);
    const photoId = randomUUID();

    const originalObjectKey = buildOriginalObjectKey(projectId, photoId, validated.fileName);
    const thumbnailObjectKey = buildThumbnailObjectKey(projectId, photoId, validated.fileName);
    const storedObjectKeys = [originalObjectKey, thumbnailObjectKey];

    const checksumSha256 = createHash('sha256').update(file!.buffer).digest('hex');

    const storageResults = await Promise.allSettled([
      this.storageService.putObject(originalObjectKey, file!.buffer),
      this.storageService.putObject(thumbnailObjectKey, thumbnailBuffer),
    ]);

    if (storageResults.some((result) => result.status === 'rejected')) {
      await this.removeStoredObjects(storedObjectKeys);

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
          thumbnailObjectKey,
          status: PhotoStatus.UPLOADED,
        },
        select: photoSelect,
      });

      return this.toPhotoDto(photo);
    } catch (error) {
      await this.removeStoredObjects(storedObjectKeys);

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

    const originalObjectKey = buildOriginalObjectKey(projectId, photo.id, photo.fileName);

    try {
      await this.storageService.statObject(originalObjectKey);
      const stream = await this.storageService.getObject(originalObjectKey);

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

    const thumbnailObjectKey = buildThumbnailObjectKey(projectId, photo.id, photo.fileName);

    try {
      const objectStat = await this.storageService.statObject(thumbnailObjectKey);
      const stream = await this.storageService.getObject(thumbnailObjectKey);

      return {
        fileName: `${getFileNameBase(photo.fileName)}${THUMBNAIL_FILE_NAME_SUFFIX}`,
        mimeType: 'image/webp',
        sizeBytes: objectStat.size,
        stream,
      };
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '照片缩略图读取失败',
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
    const cleanupResults = await Promise.allSettled(
      objectKeys.map((objectKey) => this.storageService.removeObject(objectKey)),
    );

    cleanupResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const objectKey = objectKeys[index];
        const cleanupError = result.reason;

        this.logger.error(
          `Failed to remove orphaned upload objectKey=${objectKey}`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
    });
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
      thumbnailUrl: buildPublicUrl(
        photo.thumbnailObjectKey ??
          buildThumbnailObjectKey(photo.projectId, photo.id, photo.fileName),
      ),
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }
}

function buildPublicUrl(objectKey: string): string {
  const encodedObjectKey = objectKey.split('/').map(encodeURIComponent).join('/');

  return `/public/${encodedObjectKey}`;
}

function buildOriginalObjectKey(projectId: string, photoId: string, fileName: string): string {
  const uniquePrefix = `${photoId}--`;
  const availableFileNameBytes =
    MAX_STORAGE_FILE_NAME_BYTES - Buffer.byteLength(uniquePrefix, 'utf8');
  const storageFileName = truncateFileName(fileName, availableFileNameBytes);

  return `projects/${projectId}/photos/${uniquePrefix}${storageFileName}`;
}

function buildThumbnailObjectKey(projectId: string, photoId: string, fileName: string): string {
  const uniquePrefix = `${photoId}--`;
  const availableBaseNameBytes =
    MAX_STORAGE_FILE_NAME_BYTES -
    Buffer.byteLength(uniquePrefix, 'utf8') -
    Buffer.byteLength(THUMBNAIL_FILE_NAME_SUFFIX, 'utf8');
  const storageBaseName = truncateUtf8(getFileNameBase(fileName), availableBaseNameBytes);

  return `projects/${projectId}/photos/${uniquePrefix}${storageBaseName}${THUMBNAIL_FILE_NAME_SUFFIX}`;
}

function getFileNameBase(fileName: string): string {
  const extensionStart = fileName.lastIndexOf('.');

  return extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;
}

function truncateFileName(fileName: string, maxBytes: number): string {
  if (Buffer.byteLength(fileName, 'utf8') <= maxBytes) {
    return fileName;
  }

  const extensionStart = fileName.lastIndexOf('.');
  const extension = extensionStart > 0 ? fileName.slice(extensionStart) : '';

  if (Buffer.byteLength(extension, 'utf8') >= maxBytes) {
    return truncateUtf8(fileName, maxBytes);
  }

  const baseName = extension ? fileName.slice(0, extensionStart) : fileName;

  return `${truncateUtf8(baseName, maxBytes - Buffer.byteLength(extension, 'utf8'))}${extension}`;
}

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0;
  let result = '';

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');

    if (bytes + characterBytes > maxBytes) {
      break;
    }

    bytes += characterBytes;
    result += character;
  }

  return result;
}
