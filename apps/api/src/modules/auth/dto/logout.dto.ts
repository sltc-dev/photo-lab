import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  // 退出通过 Refresh Token 定位需要撤销的数据库记录。
  @ApiProperty({ minLength: 32, type: String })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
