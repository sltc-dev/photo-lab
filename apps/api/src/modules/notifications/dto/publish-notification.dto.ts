import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationLevel, NotificationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PublishNotificationDto {
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  @IsEnum(NotificationType)
  type: NotificationType = NotificationType.SYSTEM;

  @ApiProperty({ enum: NotificationLevel, enumName: 'NotificationLevel' })
  @IsEnum(NotificationLevel)
  level: NotificationLevel = NotificationLevel.INFO;

  @ApiProperty({ maxLength: 120, minLength: 1, type: String })
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiProperty({ maxLength: 280, minLength: 1, type: String })
  @Transform(trimString)
  @IsString()
  @Length(1, 280)
  summary!: string;

  @ApiProperty({ maxLength: 20_000, minLength: 1, type: String })
  @Transform(trimString)
  @IsString()
  @Length(1, 20_000)
  content!: string;

  @ApiPropertyOptional({ maxLength: 50, type: String })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetVersion?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsISO8601({ strict: true })
  @IsOptional()
  publishedAt?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsISO8601({ strict: true })
  @IsOptional()
  expiresAt?: string;
}
