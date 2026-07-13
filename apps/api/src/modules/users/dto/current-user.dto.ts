import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}
