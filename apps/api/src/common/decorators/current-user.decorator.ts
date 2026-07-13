import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import type { AuthenticatedRequest, RequestUser } from '../types/authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser => {
    // 切换到 HTTP 上下文后，拿到 JwtAuthGuard 已经处理过的 Express Request。
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      // 正常情况下 Guard 会先写入 user；这层检查防止装饰器被误用在未保护的接口上。
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_EXPIRED', '登录已过期');
    }

    return request.user;
  },
);
