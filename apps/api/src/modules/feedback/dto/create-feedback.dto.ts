import { ApiProperty } from '@nestjs/swagger';
import { FeedbackCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  @IsEnum(FeedbackCategory)
  category!: FeedbackCategory;

  @ApiProperty({ maxLength: 2000, minLength: 1, type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  message!: string;
}
