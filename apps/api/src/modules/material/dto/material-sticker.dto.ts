import { ApiProperty } from '@nestjs/swagger';

export class MaterialStickerDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) url!: string;
  @ApiProperty({ format: 'date-time', type: String }) createdAt!: string;
}
