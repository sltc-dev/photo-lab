import { ApiProperty } from '@nestjs/swagger';
import { CurrentUserDto } from '../../users/dto/current-user.dto';

export class AuthSessionDto {
  // 短期 Token：前端访问受保护接口时放进 Authorization Header。
  @ApiProperty({ type: String })
  accessToken!: string;

  // 长期续期凭证：Electron 主进程保存，不进入 React 渲染进程。
  @ApiProperty({ type: String })
  refreshToken!: string;

  @ApiProperty({ type: CurrentUserDto })
  user!: CurrentUserDto;
}
