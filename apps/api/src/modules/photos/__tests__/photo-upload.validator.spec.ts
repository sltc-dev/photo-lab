import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../../config/env';
import { PhotoUploadValidator, type UploadedPhotoFile } from '../photo-upload.validator';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const WEBP_BUFFER = Buffer.from('RIFF0000WEBP', 'ascii');

function createValidator(maxBytes = 1024): PhotoUploadValidator {
  const configService = {
    getOrThrow: vi.fn(() => maxBytes),
  } as unknown as ConfigService<AppEnv, true>;

  return new PhotoUploadValidator(configService);
}

function createFile(buffer: Buffer, overrides: Partial<UploadedPhotoFile> = {}): UploadedPhotoFile {
  return {
    buffer,
    mimetype: 'application/octet-stream',
    originalname: 'photo.jpg',
    size: buffer.length,
    ...overrides,
  };
}

async function expectInvalidFile(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
    throw new Error('Expected invalid file');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect((error as BadRequestException).getResponse()).toMatchObject({ message: '文件无效' });
  }
}

describe('PhotoUploadValidator', () => {
  it('rejects a missing file', async () => {
    await expectInvalidFile(() => createValidator().validate(undefined));
  });

  it('rejects an empty file', async () => {
    await expectInvalidFile(() => createValidator().validate(createFile(Buffer.alloc(0))));
  });

  it('rejects a file that exceeds the configured size limit', async () => {
    await expectInvalidFile(() => createValidator(3).validate(createFile(JPEG_BUFFER)));
  });

  it.each([
    {
      buffer: JPEG_BUFFER,
      extension: 'jpg',
      mimeType: 'image/jpeg',
      originalname: 'holiday.fake',
    },
    {
      buffer: PNG_BUFFER,
      extension: 'png',
      mimeType: 'image/png',
      originalname: 'holiday.png',
    },
    {
      buffer: WEBP_BUFFER,
      extension: 'webp',
      mimeType: 'image/webp',
      originalname: 'holiday.webp',
    },
  ])('detects $mimeType from the file contents', async (example) => {
    const result = await createValidator().validate(
      createFile(example.buffer, {
        mimetype: 'text/plain',
        originalname: example.originalname,
      }),
    );

    expect(result).toEqual({
      extension: example.extension,
      fileName: example.originalname,
      mimeType: example.mimeType,
      sizeBytes: example.buffer.length,
    });
  });

  it('rejects unsupported content even when the client claims it is JPEG', async () => {
    const file = createFile(Buffer.from('not an image'), {
      mimetype: 'image/jpeg',
      originalname: 'fake.jpg',
    });

    await expectInvalidFile(() => createValidator().validate(file));
  });

  it('removes path components and control characters from the display name', async () => {
    const result = await createValidator().validate(
      createFile(JPEG_BUFFER, {
        originalname: '../../private/family\u0000-photo.jpg',
      }),
    );

    expect(result.fileName).toBe('family-photo.jpg');
  });

  it('uses a safe fallback when the sanitized file name is empty', async () => {
    const result = await createValidator().validate(
      createFile(PNG_BUFFER, {
        originalname: '\u0000',
      }),
    );

    expect(result.fileName).toBe('upload.png');
  });
});
