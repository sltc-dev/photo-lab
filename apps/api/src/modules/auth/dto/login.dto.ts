import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  // 登录和注册使用相同的邮箱标准化方式，避免大小写导致“注册了却登录不了”。
  @ApiProperty({ example: 'user@example.com', format: 'email', type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ maxLength: 128, minLength: 8, type: String })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
