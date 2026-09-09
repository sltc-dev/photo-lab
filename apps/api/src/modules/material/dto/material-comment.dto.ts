import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MATERIAL_STICKER_KEYS = [
  'like',
  'laugh',
  'love',
  'celebrate',
  'wow',
  'think',
] as const;

export class CreateMaterialCommentDto {
  @ApiPropertyOptional({ description: '评论内容，支持 Unicode 表情', maxLength: 500, type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({ description: '内置表情 key 或自定义表情 ID', type: String })
  @IsString()
  @IsOptional()
  stickerKey?: string;
}

export class MaterialCommentAuthorDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  userName!: string;
}

export class MaterialCommentDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  photoId!: string;

  @ApiProperty({ type: MaterialCommentAuthorDto })
  author!: MaterialCommentAuthorDto;

  @ApiProperty({ description: '评论内容，可能包含 Unicode 表情', type: String })
  content!: string | null;

  @ApiProperty({ nullable: true, type: String })
  stickerKey!: string | null;

  @ApiProperty({ nullable: true, type: String })
  stickerUrl!: string | null;

  @ApiProperty({ description: '当前用户是否可删除此评论', type: Boolean })
  canDelete!: boolean;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}
