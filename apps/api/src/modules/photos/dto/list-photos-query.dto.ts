import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PhotoKind } from '@prisma/client';

export class ListPhotosQueryDto {
  @ApiPropertyOptional({
    description: '照片类型；不传时返回全部照片',
    enum: PhotoKind,
    enumName: 'PhotoKind',
  })
  @IsEnum(PhotoKind)
  @IsOptional()
  kind?: PhotoKind;

  @ApiPropertyOptional({
    description: '上一页返回的游标',
    type: String,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: 12,
    description: '每页照片数量',
    maximum: 100,
    minimum: 1,
    type: Number,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 12;
}
