import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { buildPublicUrl } from '../storage/storage-url.util';
import { MaterialStickerDto } from './dto/material-sticker.dto';
import type { UploadedPhotoFile } from '../photos/photo-upload.validator';

@Injectable()
export class MaterialStickersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string): Promise<MaterialStickerDto[]> {
    const items = await this.prisma.userSticker.findMany({
      where: { deletedAt: null, userId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({
      id: item.id,
      url: buildPublicUrl(item.objectKey),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async upload(userId: string, file?: UploadedPhotoFile): Promise<MaterialStickerDto> {
    if (!file || file.size <= 0 || file.size > 10 * 1024 * 1024)
      throw new BadRequestException('请选择 10MB 以内的图片');
    let image: Buffer;
    try {
      image = await sharp(file.buffer)
        .rotate()
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      throw new BadRequestException('图片格式无效');
    }
    const id = randomUUID();
    const objectKey = `stickers/${userId}/${id}.webp`;
    await this.storage.putObject(objectKey, image);
    const item = await this.prisma.userSticker.create({ data: { id, objectKey, userId } });
    return {
      id: item.id,
      url: buildPublicUrl(item.objectKey),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async remove(userId: string, stickerId: string): Promise<void> {
    const sticker = await this.prisma.userSticker.findFirst({ where: { deletedAt: null, id: stickerId, userId } });
    if (!sticker) return;
    await this.prisma.userSticker.update({ data: { deletedAt: new Date() }, where: { id: sticker.id } });
  }
}
