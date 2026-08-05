import { HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppException } from '../../common/errors/app.exception';

export type PhotoMetadata = {
  height: number;
  width: number;
};

@Injectable()
export class PhotoMetadataReader {
  async readMetadata(buffer: Buffer): Promise<PhotoMetadata> {
    try {
      const metadata = await sharp(buffer, { failOn: 'error' }).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Image dimensions are missing');
      }

      const shouldSwap = metadata.orientation !== undefined && metadata.orientation >= 5;

      return {
        height: shouldSwap ? metadata.width : metadata.height,
        width: shouldSwap ? metadata.height : metadata.width,
      };
    } catch {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'PHOTO_UNSUPPORTED_TYPE',
        '无法读取图片信息，请选择有效的 JPEG、PNG 或 WebP 图片',
      );
    }
  }
}
