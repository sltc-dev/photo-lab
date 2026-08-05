import { ApiProperty } from '@nestjs/swagger';
import { PhotoStatus } from '@prisma/client';

export class PhotoDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  projectId!: string;

  @ApiProperty({
    description: '用户上传时的原始文件名',
    type: String,
  })
  fileName!: string;

  @ApiProperty({
    example: 'image/jpeg',
    type: String,
  })
  mimeType!: string;

  @ApiProperty({
    description: '原始图片的 API 相对 URL',
    example: '/public/projects/project-id/photos/photo-id--holiday.jpg',
    type: String,
  })
  originalUrl!: string;

  @ApiProperty({
    description: '缩略图的 API 相对 URL',
    example: '/public/projects/project-id/photos/photo-id--holiday.thumbnail.webp',
    type: String,
  })
  thumbnailUrl!: string;

  @ApiProperty({
    description: '原始图片大小，单位为字节',
    example: 4839201,
    type: Number,
  })
  sizeBytes!: number;

  @ApiProperty({
    nullable: true,
    type: Number,
  })
  width!: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
  })
  height!: number | null;

  @ApiProperty({
    enum: PhotoStatus,
    enumName: 'PhotoStatus',
  })
  status!: PhotoStatus;

  @ApiProperty({
    format: 'date-time',
    type: String,
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    type: String,
  })
  updatedAt!: string;
}
