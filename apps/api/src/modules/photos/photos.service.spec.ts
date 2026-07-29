import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { HttpStatus } from '@nestjs/common';
import { PhotoStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PhotoMetadataReader } from './photo-metadata.reader';
import { PhotoThumbnailGenerator } from './photo-thumbnail.generator';
import { PhotoUploadValidator, type UploadedPhotoFile } from './photo-upload.validator';
import { PhotosService } from './photos.service';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const THUMBNAIL_BUFFER = Buffer.from('thumbnail');

const uploadedFile: UploadedPhotoFile = {
  buffer: JPEG_BUFFER,
  mimetype: 'image/jpeg',
  originalname: 'holiday.jpg',
  size: JPEG_BUFFER.length,
};

const photoRecord = {
  createdAt: new Date('2026-07-27T08:00:00.000Z'),
  fileName: 'holiday.jpg',
  height: 800,
  id: 'photo-1',
  mimeType: 'image/jpeg',
  projectId: 'project-1',
  sizeBytes: JPEG_BUFFER.length,
  status: PhotoStatus.UPLOADED,
  updatedAt: new Date('2026-07-27T09:00:00.000Z'),
  width: 1200,
};

type HarnessOptions = {
  createError?: Error;
  fileName?: string;
  metadataError?: Error;
  project?: { id: string } | null;
  storageError?: Error;
  thumbnailError?: Error;
};

function createHarness(options: HarnessOptions = {}) {
  const findFirst = vi
    .fn()
    .mockResolvedValue(options.project === undefined ? { id: 'project-1' } : options.project);
  const create = options.createError
    ? vi.fn().mockRejectedValue(options.createError)
    : vi.fn().mockResolvedValue(photoRecord);
  const putObject = options.storageError
    ? vi.fn().mockRejectedValue(options.storageError)
    : vi.fn().mockResolvedValue(undefined);
  const removeObject = vi.fn().mockResolvedValue(undefined);
  const validate = vi.fn(() => ({
    extension: 'jpg' as const,
    fileName: options.fileName ?? 'holiday.jpg',
    mimeType: 'image/jpeg' as const,
    sizeBytes: JPEG_BUFFER.length,
  }));
  const readMetadata = options.metadataError
    ? vi.fn().mockRejectedValue(options.metadataError)
    : vi.fn().mockResolvedValue({
        height: 800,
        width: 1200,
      });
  const generateThumbnail = options.thumbnailError
    ? vi.fn().mockRejectedValue(options.thumbnailError)
    : vi.fn().mockResolvedValue(THUMBNAIL_BUFFER);

  const prisma = {
    photo: {
      create,
    },
    project: {
      findFirst,
    },
  } as unknown as PrismaService;
  const storage = {
    putObject,
    removeObject,
  } as unknown as StorageService;
  const validator = {
    validate,
  } as unknown as PhotoUploadValidator;
  const metadataReader = {
    readMetadata,
  } as unknown as PhotoMetadataReader;
  const thumbnailGenerator = {
    generate: generateThumbnail,
  } as unknown as PhotoThumbnailGenerator;

  return {
    create,
    findFirst,
    generateThumbnail,
    putObject,
    readMetadata,
    removeObject,
    service: new PhotosService(prisma, storage, validator, metadataReader, thumbnailGenerator),
    validate,
  };
}

describe('PhotosService.uploadPhoto', () => {
  it('stores the original image and creates an uploaded photo record', async () => {
    const harness = createHarness();

    await expect(harness.service.uploadPhoto('user-1', 'project-1', uploadedFile)).resolves.toEqual(
      {
        createdAt: '2026-07-27T08:00:00.000Z',
        fileName: 'holiday.jpg',
        height: 800,
        id: 'photo-1',
        mimeType: 'image/jpeg',
        projectId: 'project-1',
        sizeBytes: JPEG_BUFFER.length,
        status: PhotoStatus.UPLOADED,
        updatedAt: '2026-07-27T09:00:00.000Z',
        width: 1200,
      },
    );

    expect(harness.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        id: 'project-1',
        userId: 'user-1',
      },
    });
    expect(harness.validate).toHaveBeenCalledWith(uploadedFile);
    expect(harness.readMetadata).toHaveBeenCalledWith(JPEG_BUFFER);
    expect(harness.generateThumbnail).toHaveBeenCalledWith(JPEG_BUFFER);
    expect(harness.putObject).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^projects\/project-1\/photos\/[^/]+--holiday\.jpg$/),
      JPEG_BUFFER,
    );
    expect(harness.putObject).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^projects\/project-1\/photos\/[^/]+--holiday\.thumbnail\.webp$/),
      THUMBNAIL_BUFFER,
    );
    expect(harness.create).toHaveBeenCalledWith({
      data: {
        checksumSha256: createHash('sha256').update(JPEG_BUFFER).digest('hex'),
        fileName: 'holiday.jpg',
        id: expect.any(String),
        height: 800,
        mimeType: 'image/jpeg',
        originalObjectKey: expect.stringMatching(
          /^projects\/project-1\/photos\/[^/]+--holiday\.jpg$/,
        ),
        projectId: 'project-1',
        relativePath: 'holiday.jpg',
        sizeBytes: JPEG_BUFFER.length,
        status: PhotoStatus.UPLOADED,
        thumbnailObjectKey: expect.stringMatching(
          /^projects\/project-1\/photos\/[^/]+--holiday\.thumbnail\.webp$/,
        ),
        width: 1200,
      },
      select: expect.any(Object),
    });
    expect(harness.putObject.mock.invocationCallOrder[0]).toBeLessThan(
      harness.create.mock.invocationCallOrder[0]!,
    );
    expect(harness.removeObject).not.toHaveBeenCalled();
  });

  it('preserves a readable Unicode file name without exceeding file-system limits', async () => {
    const fileName = `${'旅行照片'.repeat(100)}.jpg`;
    const harness = createHarness({ fileName });

    await harness.service.uploadPhoto('user-1', 'project-1', uploadedFile);

    const objectKey = harness.putObject.mock.calls[0]![0] as string;
    const storedFileName = objectKey.split('/').at(-1)!;

    expect(storedFileName).toMatch(/^[^/]+--旅行照片/);
    expect(storedFileName.endsWith('.jpg')).toBe(true);
    expect(Buffer.byteLength(storedFileName, 'utf8')).toBeLessThanOrEqual(255);
    expect(harness.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName,
          originalObjectKey: objectKey,
        }),
      }),
    );
  });

  it('returns the same not-found error for a missing or unowned project', async () => {
    const harness = createHarness({ project: null });

    try {
      await harness.service.uploadPhoto('user-1', 'unowned-project', uploadedFile);
      throw new Error('Expected PROJECT_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect((error as AppException).getResponse()).toEqual({
        code: 'PROJECT_NOT_FOUND',
        details: null,
        message: '图库项目不存在',
      });
    }

    expect(harness.validate).not.toHaveBeenCalled();
    expect(harness.generateThumbnail).not.toHaveBeenCalled();
    expect(harness.putObject).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('does not create a database record when storage fails', async () => {
    const harness = createHarness({
      storageError: new Error('disk full'),
    });

    try {
      await harness.service.uploadPhoto('user-1', 'project-1', uploadedFile);
      throw new Error('Expected PHOTO_STORAGE_FAILED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect((error as AppException).getResponse()).toEqual({
        code: 'PHOTO_STORAGE_FAILED',
        details: null,
        message: '图片保存失败',
      });
    }

    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.removeObject).toHaveBeenCalledTimes(2);
  });

  it('does not store an invalid image when its metadata cannot be read', async () => {
    const metadataError = new AppException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'PHOTO_UNSUPPORTED_TYPE',
      '无法读取图片信息',
    );
    const harness = createHarness({ metadataError });

    await expect(harness.service.uploadPhoto('user-1', 'project-1', uploadedFile)).rejects.toBe(
      metadataError,
    );
    expect(harness.generateThumbnail).not.toHaveBeenCalled();
    expect(harness.putObject).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('does not store an image when thumbnail generation fails', async () => {
    const thumbnailError = new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'PHOTO_STORAGE_FAILED',
      '缩略图生成失败',
    );
    const harness = createHarness({ thumbnailError });

    await expect(harness.service.uploadPhoto('user-1', 'project-1', uploadedFile)).rejects.toBe(
      thumbnailError,
    );
    expect(harness.putObject).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('removes the stored object when database creation fails', async () => {
    const databaseError = new Error('database unavailable');
    const harness = createHarness({
      createError: databaseError,
    });

    await expect(harness.service.uploadPhoto('user-1', 'project-1', uploadedFile)).rejects.toBe(
      databaseError,
    );

    const storedObjectKeys = harness.putObject.mock.calls.map(([objectKey]) => objectKey);
    expect(harness.removeObject).toHaveBeenCalledTimes(2);
    expect(harness.removeObject).toHaveBeenCalledWith(storedObjectKeys[0]);
    expect(harness.removeObject).toHaveBeenCalledWith(storedObjectKeys[1]);
  });
});

describe('PhotosService photo queries', () => {
  it('lists photos from an owned project in newest-first order', async () => {
    const projectFindFirst = vi.fn().mockResolvedValue({ id: 'project-1' });
    const photoFindMany = vi.fn().mockResolvedValue([photoRecord]);
    const prisma = {
      photo: {
        findMany: photoFindMany,
      },
      project: {
        findFirst: projectFindFirst,
      },
    } as unknown as PrismaService;
    const service = new PhotosService(
      prisma,
      {} as StorageService,
      {} as PhotoUploadValidator,
      {} as PhotoMetadataReader,
      {} as PhotoThumbnailGenerator,
    );

    await expect(service.listPhotos('user-1', 'project-1')).resolves.toEqual([
      {
        createdAt: '2026-07-27T08:00:00.000Z',
        fileName: 'holiday.jpg',
        height: 800,
        id: 'photo-1',
        mimeType: 'image/jpeg',
        projectId: 'project-1',
        sizeBytes: JPEG_BUFFER.length,
        status: PhotoStatus.UPLOADED,
        updatedAt: '2026-07-27T09:00:00.000Z',
        width: 1200,
      },
    ]);
    expect(projectFindFirst).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        id: 'project-1',
        userId: 'user-1',
      },
    });
    expect(photoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          projectId: 'project-1',
        },
      }),
    );
  });

  it('returns an owned original photo stream from the current storage path', async () => {
    const stream = Readable.from(JPEG_BUFFER);
    const photoFindFirst = vi.fn().mockResolvedValue({
      id: 'photo-1',
      fileName: 'holiday.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG_BUFFER.length,
    });
    const statObject = vi.fn().mockResolvedValue({
      lastModified: new Date(),
      size: JPEG_BUFFER.length,
    });
    const getObject = vi.fn().mockResolvedValue(stream);
    const prisma = {
      photo: {
        findFirst: photoFindFirst,
      },
    } as unknown as PrismaService;
    const storage = {
      getObject,
      statObject,
    } as unknown as StorageService;
    const service = new PhotosService(
      prisma,
      storage,
      {} as PhotoUploadValidator,
      {} as PhotoMetadataReader,
      {} as PhotoThumbnailGenerator,
    );

    await expect(service.getOriginalPhoto('user-1', 'project-1', 'photo-1')).resolves.toEqual({
      fileName: 'holiday.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG_BUFFER.length,
      stream,
    });
    expect(photoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'photo-1',
          project: {
            userId: 'user-1',
          },
          projectId: 'project-1',
        },
      }),
    );
    expect(statObject).toHaveBeenCalledWith('projects/project-1/photos/photo-1--holiday.jpg');
    expect(getObject).toHaveBeenCalledWith('projects/project-1/photos/photo-1--holiday.jpg');
  });

  it('returns an owned WebP thumbnail stream from the current storage path', async () => {
    const stream = Readable.from(THUMBNAIL_BUFFER);
    const photoFindFirst = vi.fn().mockResolvedValue({
      id: 'photo-1',
      fileName: 'holiday.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG_BUFFER.length,
    });
    const statObject = vi.fn().mockResolvedValue({
      lastModified: new Date(),
      size: THUMBNAIL_BUFFER.length,
    });
    const getObject = vi.fn().mockResolvedValue(stream);
    const prisma = {
      photo: {
        findFirst: photoFindFirst,
      },
    } as unknown as PrismaService;
    const storage = {
      getObject,
      statObject,
    } as unknown as StorageService;
    const service = new PhotosService(
      prisma,
      storage,
      {} as PhotoUploadValidator,
      {} as PhotoMetadataReader,
      {} as PhotoThumbnailGenerator,
    );

    await expect(service.getThumbnailPhoto('user-1', 'project-1', 'photo-1')).resolves.toEqual({
      fileName: 'holiday.thumbnail.webp',
      mimeType: 'image/webp',
      sizeBytes: THUMBNAIL_BUFFER.length,
      stream,
    });
    expect(statObject).toHaveBeenCalledWith(
      'projects/project-1/photos/photo-1--holiday.thumbnail.webp',
    );
    expect(getObject).toHaveBeenCalledWith(
      'projects/project-1/photos/photo-1--holiday.thumbnail.webp',
    );
  });

  it('hides missing and unowned photos behind the same not-found error', async () => {
    const prisma = {
      photo: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const service = new PhotosService(
      prisma,
      {} as StorageService,
      {} as PhotoUploadValidator,
      {} as PhotoMetadataReader,
      {} as PhotoThumbnailGenerator,
    );

    try {
      await service.getOriginalPhoto('user-1', 'project-1', 'unowned-photo');
      throw new Error('Expected PHOTO_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect((error as AppException).getResponse()).toEqual({
        code: 'PHOTO_NOT_FOUND',
        details: null,
        message: '照片不存在',
      });
    }
  });
});
