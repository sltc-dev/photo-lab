import { ApiProperty } from '@nestjs/swagger';

export class ProjectDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({
    description: '项目中的图片数量',
    example: 0,
    type: Number,
  })
  photoCount!: number;

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
