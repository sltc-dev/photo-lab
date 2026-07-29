import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    example: '2026 夏季旅行',
    maxLength: 100,
    minLength: 1,
    type: String,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({
    example: '用于整理夏季旅行拍摄的照片',
    maxLength: 500,
    type: String,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
