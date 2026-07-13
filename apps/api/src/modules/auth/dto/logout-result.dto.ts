import { ApiProperty } from '@nestjs/swagger';

export class LogoutResultDto {
  @ApiProperty({ example: true, type: Boolean })
  ok!: true;
}
