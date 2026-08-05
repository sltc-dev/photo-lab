import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import type { AppEnv } from '../../config/env';

export type UploadedPhotoFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type ValidatedPhotoUpload = {
  extension: 'jpg' | 'png' | 'webp';
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
};

@Injectable()
export class PhotoUploadValidator {
  private readonly maxBytes: number;

  constructor(@Inject(ConfigService) configService: ConfigService<AppEnv, true>) {
    this.maxBytes = configService.getOrThrow('PHOTO_UPLOAD_MAX_BYTES');
  }

  validate(file: UploadedPhotoFile | undefined): ValidatedPhotoUpload {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'PHOTO_FILE_REQUIRED', '请选择要上传的图片');
    }

    if (file.size <= 0 || file.buffer.length <= 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'PHOTO_FILE_REQUIRED', '上传的图片不能为空');
    }

    if (file.size > this.maxBytes) {
      throw new AppException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PHOTO_FILE_TOO_LARGE',
        '上传的图片超过大小限制',
        {
          maxBytes: this.maxBytes,
        },
      );
    }

    const detectedType = detectImageType(file.buffer);

    if (!detectedType) {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'PHOTO_UNSUPPORTED_TYPE',
        '仅支持 JPEG、PNG 和 WebP 图片',
      );
    }

    return {
      ...detectedType,
      fileName: sanitizeFileName(file.originalname, detectedType.extension),
      sizeBytes: file.size,
    };
  }
}

function detectImageType(buffer: Buffer):
  | {
      extension: 'jpg';
      mimeType: 'image/jpeg';
    }
  | {
      extension: 'png';
      mimeType: 'image/png';
    }
  | {
      extension: 'webp';
      mimeType: 'image/webp';
    }
  | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {
      extension: 'jpg',
      mimeType: 'image/jpeg',
    };
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (
    buffer.length >= pngSignature.length &&
    buffer.subarray(0, pngSignature.length).equals(pngSignature)
  ) {
    return {
      extension: 'png',
      mimeType: 'image/png',
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      extension: 'webp',
      mimeType: 'image/webp',
    };
  }

  return null;
}

function sanitizeFileName(originalName: string, fallbackExtension: 'jpg' | 'png' | 'webp'): string {
  const pathSegments = originalName.replaceAll('\\', '/').split('/');
  const baseName = pathSegments.at(-1) ?? '';

  const withoutControlCharacters = Array.from(baseName)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();

  if (!withoutControlCharacters) {
    return `upload.${fallbackExtension}`;
  }

  return withoutControlCharacters.slice(0, 255);
}
