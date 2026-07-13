import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  // 网络数据先标准化，再校验；Service 和数据库收到的邮箱始终是小写形式。
  @ApiProperty({ example: 'user@example.com', format: 'email', type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  // trim 后再检查长度，纯空格用户名不会通过。
  @ApiProperty({ maxLength: 32, minLength: 2, type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 32)
  username!: string;

  // 128 上限既限制异常输入体积，也与当前密码 Hash 输入策略保持一致。
  @ApiProperty({ maxLength: 128, minLength: 8, type: String })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
