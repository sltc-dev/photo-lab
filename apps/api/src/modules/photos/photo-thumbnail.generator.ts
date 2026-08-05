import { HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppException } from '../../common/errors/app.exception';

const THUMBNAIL_MAX_EDGE = 640;
const THUMBNAIL_WEBP_QUALITY = 80;

@Injectable()
export class PhotoThumbnailGenerator {
  async generate(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer, { failOn: 'error' })
        .rotate()
        .resize({
          fit: 'inside',
          height: THUMBNAIL_MAX_EDGE,
          width: THUMBNAIL_MAX_EDGE,
          withoutEnlargement: true,
        })
        .webp({
          quality: THUMBNAIL_WEBP_QUALITY,
        })
        .toBuffer();
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '缩略图生成失败',
      );
    }
  }
}
