import { ApiProperty } from '@nestjs/swagger';
import { FeedbackCategory } from '@prisma/client';

export class FeedbackDto {
  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  category!: FeedbackCategory;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ example: 'PL-A1B2C3D4E5F6', type: String })
  referenceId!: string;
}
