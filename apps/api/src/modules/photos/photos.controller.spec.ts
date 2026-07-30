import { Readable } from 'node:stream';
import { PhotoStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { RequestUser } from '../../common/types/authenticated-request';
import type { PhotoDto } from './dto/photo.dto';
import type { UploadedPhotoFile } from './photo-upload.validator';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

const user: RequestUser = {
  id: 'user-1',
};

const uploadedFile: UploadedPhotoFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  mimetype: 'image/jpeg',
  originalname: 'holiday.jpg',
  size: 4,
};

const photoDto: PhotoDto = {
  createdAt: '2026-07-27T08:00:00.000Z',
  fileName: 'holiday.jpg',
  height: null,
  id: 'photo-1',
  mimeType: 'image/jpeg',
  originalUrl: '/public/projects/project-1/photos/photo-1--holiday.jpg',
  projectId: 'project-1',
  sizeBytes: 4,
  status: PhotoStatus.UPLOADED,
  thumbnailUrl: '/public/projects/project-1/photos/photo-1--holiday.thumbnail.webp',
  updatedAt: '2026-07-27T09:00:00.000Z',
  width: null,
};

function createController() {
  const getOriginalPhoto = vi.fn().mockResolvedValue({
    fileName: 'holiday.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    stream: Readable.from(uploadedFile.buffer),
  });
  const getThumbnailPhoto = vi.fn().mockResolvedValue({
    fileName: 'holiday.thumbnail.webp',
    mimeType: 'image/webp',
    sizeBytes: 2,
    stream: Readable.from(Buffer.from([0x01, 0x02])),
  });
  const listPhotos = vi.fn().mockResolvedValue({
    items: [photoDto],
    nextCursor: null,
  });
  const uploadPhoto = vi.fn().mockResolvedValue(photoDto);
  const service = {
    getOriginalPhoto,
    getThumbnailPhoto,
    listPhotos,
    uploadPhoto,
  } as unknown as PhotosService;

  return {
    controller: new PhotosController(service),
    getOriginalPhoto,
    getThumbnailPhoto,
    listPhotos,
    uploadPhoto,
  };
}

describe('PhotosController', () => {
  it('lists photos for the authenticated project owner', async () => {
    const { controller, listPhotos } = createController();

    const query = { limit: 12 };

    await expect(controller.listPhotos(user, 'project-1', query)).resolves.toEqual({
      items: [photoDto],
      nextCursor: null,
    });
    expect(listPhotos).toHaveBeenCalledWith('user-1', 'project-1', query);
  });

  it('streams an original photo with private image response headers', async () => {
    const { controller, getOriginalPhoto } = createController();
    const set = vi.fn();
    const response = {
      set,
    } as unknown as Response;

    const result = await controller.getOriginalPhoto(user, 'project-1', 'photo-1', response);

    expect(getOriginalPhoto).toHaveBeenCalledWith('user-1', 'project-1', 'photo-1');
    expect(set).toHaveBeenCalledWith({
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': "inline; filename*=UTF-8''holiday.jpg",
      'Content-Length': '4',
      'Content-Type': 'image/jpeg',
    });
    expect(result.getStream()).toBeInstanceOf(Readable);
  });

  it('streams a cacheable WebP thumbnail for the authenticated project owner', async () => {
    const { controller, getThumbnailPhoto } = createController();
    const set = vi.fn();
    const response = {
      set,
    } as unknown as Response;

    const result = await controller.getThumbnailPhoto(user, 'project-1', 'photo-1', response);

    expect(getThumbnailPhoto).toHaveBeenCalledWith('user-1', 'project-1', 'photo-1');
    expect(set).toHaveBeenCalledWith({
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': "inline; filename*=UTF-8''holiday.thumbnail.webp",
      'Content-Length': '2',
      'Content-Type': 'image/webp',
    });
    expect(result.getStream()).toBeInstanceOf(Readable);
  });

  it('passes the authenticated user, project ID, and file to the service', async () => {
    const { controller, uploadPhoto } = createController();

    await expect(controller.uploadPhoto(user, 'project-1', uploadedFile)).resolves.toEqual(
      photoDto,
    );
    expect(uploadPhoto).toHaveBeenCalledWith('user-1', 'project-1', uploadedFile);
  });

  it('passes a missing file to the service so the upload validator can return the standard error', async () => {
    const { controller, uploadPhoto } = createController();

    await controller.uploadPhoto(user, 'project-1', undefined);

    expect(uploadPhoto).toHaveBeenCalledWith('user-1', 'project-1', undefined);
  });
});
