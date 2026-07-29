import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { AppEnv } from '../../config/env';
import { PhotoUploadValidator, type UploadedPhotoFile } from './photo-upload.validator';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

function expectAppException(operation: () => unknown, status: HttpStatus, code: string): void {
  try {
    operation();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(status);
    expect((error as AppException).getResponse()).toMatchObject({ code });
  }
}

describe('PhotoUploadValidator', () => {
  it('rejects a missing file', () => {
    expectAppException(
      () => createValidator().validate(undefined),
      HttpStatus.BAD_REQUEST,
      'PHOTO_FILE_REQUIRED',
    );
  });

  it('rejects an empty file', () => {
    expectAppException(
      () => createValidator().validate(createFile(Buffer.alloc(0))),
      HttpStatus.BAD_REQUEST,
      'PHOTO_FILE_REQUIRED',
    );
  });

  it('rejects a file that exceeds the configured size limit', () => {
    expectAppException(
      () => createValidator(3).validate(createFile(JPEG_BUFFER)),
      HttpStatus.PAYLOAD_TOO_LARGE,
      'PHOTO_FILE_TOO_LARGE',
    );
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
  ])('detects $mimeType from the file contents', (example) => {
    const result = createValidator().validate(
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

  it('rejects unsupported content even when the client claims it is JPEG', () => {
    const file = createFile(Buffer.from('not an image'), {
      mimetype: 'image/jpeg',
      originalname: 'fake.jpg',
    });

    expectAppException(
      () => createValidator().validate(file),
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'PHOTO_UNSUPPORTED_TYPE',
    );
  });

  it('removes path components and control characters from the display name', () => {
    const result = createValidator().validate(
      createFile(JPEG_BUFFER, {
        originalname: '../../private/family\u0000-photo.jpg',
      }),
    );

    expect(result.fileName).toBe('family-photo.jpg');
  });

  it('uses a safe fallback when the sanitized file name is empty', () => {
    const result = createValidator().validate(
      createFile(PNG_BUFFER, {
        originalname: '\u0000',
      }),
    );

    expect(result.fileName).toBe('upload.png');
  });
});
