import {
  BadRequestException,
  FileTypeValidator,
  Inject,
  Injectable,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const supportedImageTypes = [
  {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    validator: new FileTypeValidator({ fileType: 'image/jpeg' }),
  },
  {
    extension: 'png',
    mimeType: 'image/png',
    validator: new FileTypeValidator({ fileType: 'image/png' }),
  },
  {
    extension: 'webp',
    mimeType: 'image/webp',
    validator: new FileTypeValidator({ fileType: 'image/webp' }),
  },
] as const;

@Injectable()
export class PhotoUploadValidator {
  private readonly maxFileSizeValidator: MaxFileSizeValidator;

  constructor(@Inject(ConfigService) configService: ConfigService<AppEnv, true>) {
    const maxBytes = configService.getOrThrow('PHOTO_UPLOAD_MAX_BYTES');

    // Nest 的最大值校验使用严格小于；配置值表示允许的最大字节数，所以加一保持原有边界语义。
    this.maxFileSizeValidator = new MaxFileSizeValidator({ maxSize: maxBytes + 1 });
  }

  async validate(file: UploadedPhotoFile | undefined): Promise<ValidatedPhotoUpload> {
    if (!file) {
      throw new BadRequestException('文件无效');
    }

    if (file.size <= 0 || file.buffer.length <= 0) {
      throw new BadRequestException('文件无效');
    }

    if (!this.maxFileSizeValidator.isValid(file)) {
      throw new BadRequestException('文件无效');
    }

    const detectedType = await detectImageType(file);

    if (!detectedType) {
      throw new BadRequestException('文件无效');
    }

    return {
      ...detectedType,
      fileName: sanitizeFileName(file.originalname, detectedType.extension),
      sizeBytes: file.size,
    };
  }
}

async function detectImageType(file: UploadedPhotoFile) {
  for (const imageType of supportedImageTypes) {
    if (await imageType.validator.isValid(file)) {
      return {
        extension: imageType.extension,
        mimeType: imageType.mimeType,
      };
    }
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
