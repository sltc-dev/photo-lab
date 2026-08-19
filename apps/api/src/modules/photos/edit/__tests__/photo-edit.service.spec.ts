import { PhotoKind, PhotoStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StorageService } from '../../../storage/storage.service';
import { PhotoMetadataReader } from '../../photo-metadata.reader';
import { PhotoUploadValidator, type UploadedPhotoFile } from '../../photo-upload.validator';
import { PhotoEditService } from '../photo-edit.service';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const uploadedFile: UploadedPhotoFile = {
  buffer: JPEG_BUFFER,
  mimetype: 'image/jpeg',
  originalname: 'holiday.jpg',
  size: JPEG_BUFFER.length,
};

function createHarness(
  previewObjectKey: string | null = null,
  editState: Record<string, unknown> | null = null,
) {
  const photoFindFirst = vi.fn().mockResolvedValue({
    editState,
    fileName: 'holiday.jpg',
    id: 'photo-1',
    previewObjectKey,
  });
  const photoCreate = vi.fn().mockResolvedValue({ id: 'new-photo' });
  const photoUpdate = vi.fn().mockResolvedValue({ id: 'photo-1' });
  const putObject = vi.fn().mockResolvedValue(undefined);
  const removeObject = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    photo: {
      create: photoCreate,
      findFirst: photoFindFirst,
      update: photoUpdate,
    },
  } as unknown as PrismaService;
  const storage = {
    putObject,
    removeObject,
  } as unknown as StorageService;
  const validator = {
    validate: vi.fn().mockReturnValue({
      extension: 'jpg',
      fileName: 'edited.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG_BUFFER.length,
    }),
  } as unknown as PhotoUploadValidator;
  const metadataReader = {
    readMetadata: vi.fn().mockResolvedValue({ height: 600, width: 900 }),
  } as unknown as PhotoMetadataReader;

  return {
    photoCreate,
    photoUpdate,
    putObject,
    removeObject,
    service: new PhotoEditService(prisma, storage, validator, metadataReader),
  };
}

describe('PhotoEditService', () => {
  it('returns the saved editor state', async () => {
    const editState = { annotations: { text: { text: '标题' } } };
    const harness = createHarness('projects/project-1/photos/photo-1/edited/draft.webp', editState);

    await expect(
      harness.service.getEditedPhotoState('user-1', 'project-1', 'photo-1'),
    ).resolves.toEqual({
      editState,
    });
  });

  it('replaces the previous edit without changing the original', async () => {
    const previousEdit = 'projects/project-1/photos/photo-1/edited/previous.jpg';
    const harness = createHarness(previousEdit);

    const editState = { annotations: { text: { text: '标题' } } };

    await harness.service.saveEditedPhoto(
      'user-1',
      'project-1',
      'photo-1',
      uploadedFile,
      false,
      JSON.stringify(editState),
    );

    const storedKey = harness.putObject.mock.calls[0]![0] as string;
    expect(storedKey).toMatch(/^projects\/project-1\/photos\/photo-1\/edited\/[0-9a-f-]+\.jpg$/);
    expect(harness.photoUpdate).toHaveBeenCalledWith({
      data: { editState, previewObjectKey: storedKey },
      where: { id: 'photo-1' },
    });
    expect(harness.removeObject).toHaveBeenCalledWith(previousEdit);
  });

  it('creates a new photo, keeps the original, and clears the edit', async () => {
    const previousEdit = 'projects/project-1/photos/photo-1/edited/previous.jpg';
    const harness = createHarness(previousEdit);

    await harness.service.saveEditedPhoto('user-1', 'project-1', 'photo-1', uploadedFile, true);

    const storedKey = harness.putObject.mock.calls[0]![0] as string;
    expect(harness.photoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileName: 'holiday.edited.jpg',
        height: 600,
        kind: PhotoKind.EDITED,
        originalObjectKey: storedKey,
        projectId: 'project-1',
        status: PhotoStatus.UPLOADED,
        width: 900,
      }),
    });
    expect(harness.photoUpdate).toHaveBeenCalledWith({
      data: { editState: Prisma.DbNull, previewObjectKey: null },
      where: { id: 'photo-1' },
    });
    expect(harness.removeObject).toHaveBeenCalledWith(previousEdit);
    expect(harness.removeObject).toHaveBeenCalledTimes(1);
  });
});
