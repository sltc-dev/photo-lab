import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import { PhotoThumbnailGenerator } from '../photo-thumbnail.generator';

describe('PhotoThumbnailGenerator', () => {
  const generator = new PhotoThumbnailGenerator();

  it('creates a WebP thumbnail without enlarging its longest edge beyond 640 pixels', async () => {
    const source = await sharp({
      create: {
        background: '#4f46e5',
        channels: 3,
        height: 800,
        width: 1200,
      },
    })
      .jpeg()
      .toBuffer();

    const thumbnail = await generator.generate(source);
    const metadata = await sharp(thumbnail).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(427);
  });

  it('does not enlarge a source image that is already small', async () => {
    const source = await sharp({
      create: {
        background: '#ffffff',
        channels: 3,
        height: 120,
        width: 160,
      },
    })
      .png()
      .toBuffer();

    const thumbnail = await generator.generate(source);
    const metadata = await sharp(thumbnail).metadata();

    expect(metadata.width).toBe(160);
    expect(metadata.height).toBe(120);
  });

  it('returns the standard storage error for malformed image data', async () => {
    try {
      await generator.generate(Buffer.from('not-an-image'));
      throw new Error('Expected PHOTO_STORAGE_FAILED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'PHOTO_STORAGE_FAILED',
      });
    }
  });
});
