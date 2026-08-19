import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import { PhotoMetadataReader } from '../photo-metadata.reader';

describe('PhotoMetadataReader', () => {
  const reader = new PhotoMetadataReader();

  it('reads image dimensions', async () => {
    const buffer = await sharp({
      create: {
        background: '#ffffff',
        channels: 3,
        height: 7,
        width: 13,
      },
    })
      .png()
      .toBuffer();

    await expect(reader.readMetadata(buffer)).resolves.toEqual({
      height: 7,
      width: 13,
    });
  });

  it('returns display dimensions for an EXIF-rotated photo', async () => {
    const buffer = await sharp({
      create: {
        background: '#ffffff',
        channels: 3,
        height: 5,
        width: 12,
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    await expect(reader.readMetadata(buffer)).resolves.toMatchObject({
      height: 12,
      width: 5,
    });
  });

  it('rejects malformed image data', async () => {
    try {
      await reader.readMetadata(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
      throw new Error('Expected PHOTO_UNSUPPORTED_TYPE');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'PHOTO_UNSUPPORTED_TYPE',
      });
    }
  });
});
