import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../errors/app.exception';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

type AccessTokenPayload = {
  sub: string;
};

@Injectable()
/**
 * 受保护接口的门卫。
 *
 * 执行顺序：读取 Bearer Token -> 验签和检查过期时间 -> 确认用户仍存在
 * -> 把最小用户信息写入 request.user -> 允许 Controller 继续执行。
 */
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_EXPIRED', '登录已过期');
    }

    let payload: AccessTokenPayload;

    try {
      // verifyAsync 同时检查签名和 exp；任何失败都统一表现为登录已过期。
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_EXPIRED', '登录已过期');
    }

    // Token 有效不代表账号一定仍存在，因此再向数据库确认一次。
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'USER_NOT_FOUND', '用户不存在');
    }

    // 后续 @CurrentUser() 就是从这里读取当前用户 ID。
    request.user = user;

    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    // 只接受标准的 Authorization: Bearer <token> 格式。
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
