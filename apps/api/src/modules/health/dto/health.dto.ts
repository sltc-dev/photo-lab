import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ example: true, type: Boolean })
  ok!: true;
}
