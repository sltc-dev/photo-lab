import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PhotoKind, PhotoStatus } from '@prisma/client';

export class ListMaterialPhotosQueryDto {
  @ApiPropertyOptional({
    description: '照片类型；不传时返回全部照片',
    enum: PhotoKind,
    enumName: 'PhotoKind',
  })
  @IsEnum(PhotoKind)
  @IsOptional()
  kind?: PhotoKind;

  @ApiPropertyOptional({
    description: '上一页返回的图片游标',
    type: String,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: 24,
    description: '每页返回的图片数量',
    maximum: 100,
    minimum: 1,
    type: Number,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 24;
}

//定义图片返回字段
export class MaterialPhotoDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({
    description: '图片所属图库 ID',
    type: String,
  })
  projectId!: string;

  @ApiProperty({
    description: '图片所属图库名称',
    type: String,
  })
  projectName!: string;

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
    type: String,
  })
  originalUrl!: string;

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
    enum: PhotoKind,
    enumName: 'PhotoKind',
  })
  kind!: PhotoKind;

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

export class MaterialPhotoPageDto {
  @ApiProperty({
    isArray: true,
    type: MaterialPhotoDto,
  })
  items!: MaterialPhotoDto[];

  @ApiProperty({
    description: '下一页游标；没有更多图片时为 null',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}
