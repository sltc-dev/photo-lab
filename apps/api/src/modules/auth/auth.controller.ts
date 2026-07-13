import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { CurrentUserDto } from '../users/dto/current-user.dto';
import { AuthService } from './auth.service';
import { AuthSessionDto } from './dto/auth-session.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutResultDto } from './dto/logout-result.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
/**
 * 认证模块的 HTTP 入口。
 *
 * 这里声明“什么请求交给哪个函数”，不直接查数据库：
 * Body 先经过全局 ValidationPipe，再转交 AuthService 处理业务规则。
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  // 注册和登录都容易被暴力尝试，因此单独收紧为每分钟 5 次。
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<AuthSessionDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  // 自动续期可能比手动登录频繁，因此额度高于登录接口。
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthSessionDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({ type: LogoutResultDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  logout(@Body() dto: LogoutDto): Promise<LogoutResultDto> {
    return this.authService.logout(dto);
  }

  @Get('me')
  // 只有这个接口要求 Access Token；Guard 通过后才会执行 me()。
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  me(@CurrentUser() user: RequestUser): Promise<CurrentUserDto> {
    // @CurrentUser 从 request.user 取值，而 request.user 是 JwtAuthGuard 写进去的。
    return this.authService.getCurrentUser(user.id);
  }
}
