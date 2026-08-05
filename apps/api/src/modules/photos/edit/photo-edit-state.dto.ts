import { ApiProperty } from '@nestjs/swagger';

export class PhotoEditStateDto {
  @ApiProperty({ additionalProperties: true, nullable: true, type: 'object' })
  editState!: Record<string, unknown> | null;
}
