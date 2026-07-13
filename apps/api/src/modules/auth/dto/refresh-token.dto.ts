import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  // Refresh Token 是随机长字符串；最低长度先挡住明显不可能合法的输入。
  @ApiProperty({ minLength: 32, type: String })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
