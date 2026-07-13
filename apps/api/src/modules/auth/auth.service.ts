import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppException } from '../../common/errors/app.exception';
import { type AppEnv, parseDurationToMs } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserDto } from '../users/dto/current-user.dto';
import { UsersService } from '../users/users.service';
import { AuthSessionDto } from './dto/auth-session.dto';
import type { LoginDto } from './dto/login.dto';
import type { LogoutDto } from './dto/logout.dto';
import { LogoutResultDto } from './dto/logout-result.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$0zoXotFXYyx5zmSvnoEC6g$F72t4lYCrQAbYL6NNeTQvZtwhUjVIB6j3yisgkiQGfw';

type AccessTokenPayload = {
  sub: string;
};

type RefreshTokenIssue = {
  rawToken: string;
};

type TransactionClient = Prisma.TransactionClient;

@Injectable()
/**
 * 认证业务的核心：注册、登录、Token 刷新、退出和当前用户查询。
 * Controller 只负责接 HTTP；所有需要保持一致的认证规则都集中在这里。
 */
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionDto> {
    // Service 再做一次标准化，保证即使未来从非 HTTP 入口调用，业务规则仍然一致。
    const email = this.normalizeEmail(dto.email);
    const username = dto.username.trim();

    // 密码 Hash 计算较耗 CPU，所以放在事务外，避免数据库事务长时间占用连接。
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      // 创建用户和 Refresh Token 必须一起成功；任一步失败都会整体回滚。
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            username,
          },
        });
        const refreshToken = await this.issueRefreshToken(tx, user.id);
        const accessToken = await this.signAccessToken(user);

        // 返回公开用户，不把 passwordHash 暴露给 Controller 或客户端。
        return {
          accessToken,
          refreshToken: refreshToken.rawToken,
          user: this.usersService.toPublicUser(user),
        };
      });
    } catch (error) {
      // P2002 是 Prisma 的唯一约束冲突；这里把数据库错误转换成稳定的业务错误。
      if (hasPrismaCode(error, 'P2002')) {
        throw new AppException(HttpStatus.CONFLICT, 'USER_EMAIL_ALREADY_EXISTS', '邮箱已被注册');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSessionDto> {
    const email = this.normalizeEmail(dto.email);

    // email 有唯一约束，因此 findUnique 最多返回一位用户。
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    // 用户不存在时也验证一次固定 Hash，减少“邮箱不存在”和“密码错误”的耗时差异。
    const passwordMatches = await argon2.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !passwordMatches) {
      // 日志不记录邮箱和密码，客户端也只得到统一提示，避免帮助枚举账号。
      this.logger.warn('login_failed reason=invalid_credentials');
      throw this.invalidCredentials();
    }

    return this.prisma.$transaction(async (tx) => {
      // 新登录会撤销此用户之前仍有效的 Refresh Token，旧会话之后无法继续续期。
      await tx.refreshToken.updateMany({
        data: {
          revokedAt: new Date(),
        },
        where: {
          revokedAt: null,
          userId: user.id,
        },
      });

      const refreshToken = await this.issueRefreshToken(tx, user.id);
      const accessToken = await this.signAccessToken(user);

      return {
        accessToken,
        refreshToken: refreshToken.rawToken,
        user: this.usersService.toPublicUser(user),
      };
    });
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthSessionDto> {
    // 客户端提交原始 Token；数据库查询使用 Hash，数据库泄露时不会直接暴露可用 Token。
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // include.user 让后续签发 Access Token 时不必再单独查询一次用户。
      const storedToken = await tx.refreshToken.findUnique({
        include: {
          user: true,
        },
        where: {
          tokenHash,
        },
      });

      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= now) {
        throw new AppException(
          HttpStatus.UNAUTHORIZED,
          'AUTH_REFRESH_TOKEN_INVALID',
          'refresh token 无效',
        );
      }

      // 条件更新让同一个 Refresh Token 只能成功使用一次。
      // 两个并发刷新请求中，只有第一个能把 count 变成 1。
      const revokeResult = await tx.refreshToken.updateMany({
        data: {
          revokedAt: now,
        },
        where: {
          expiresAt: {
            gt: now,
          },
          id: storedToken.id,
          revokedAt: null,
        },
      });

      if (revokeResult.count !== 1) {
        throw new AppException(
          HttpStatus.UNAUTHORIZED,
          'AUTH_REFRESH_TOKEN_INVALID',
          'refresh token 无效',
        );
      }

      // Refresh Token 轮换：旧 Token 已撤销，客户端必须保存这次返回的新 Token。
      const nextRefreshToken = await this.issueRefreshToken(tx, storedToken.userId);
      const accessToken = await this.signAccessToken(storedToken.user);

      return {
        accessToken,
        refreshToken: nextRefreshToken.rawToken,
        user: this.usersService.toPublicUser(storedToken.user),
      };
    });
  }

  async logout(dto: LogoutDto): Promise<LogoutResultDto> {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);

    // updateMany 让退出保持幂等：Token 已撤销或不存在时也返回成功。
    await this.prisma.refreshToken.updateMany({
      data: {
        revokedAt: new Date(),
      },
      where: {
        revokedAt: null,
        tokenHash,
      },
    });

    return { ok: true };
  }

  async getCurrentUser(userId: string): Promise<CurrentUserDto> {
    // UsersService 只查询公开字段，避免在不需要密码的路径读取 passwordHash。
    const user = await this.usersService.findPublicUser(userId);

    if (!user) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'USER_NOT_FOUND', '用户不存在');
    }

    return user;
  }

  private async issueRefreshToken(
    tx: TransactionClient,
    userId: string,
  ): Promise<RefreshTokenIssue> {
    // 64 字节随机数具有足够大的搜索空间，base64url 便于放进 JSON 和请求体。
    const rawToken = randomBytes(64).toString('base64url');
    const tokenHash = this.hashRefreshToken(rawToken);
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.configService.getOrThrow('REFRESH_TOKEN_TTL')),
    );

    // 只把 Hash 和生命周期写进数据库，原始值通过返回值交给调用者一次。
    await tx.refreshToken.create({
      data: {
        expiresAt,
        tokenHash,
        userId,
      },
    });

    return { rawToken };
  }

  private hashRefreshToken(token: string): string {
    // 混入服务端 Secret 后再 Hash，即使数据库泄露，攻击者也不能直接离线比对原始 Token。
    return createHash('sha256')
      .update(`${token}.${this.configService.getOrThrow('JWT_REFRESH_SECRET')}`)
      .digest('hex');
  }

  private async signAccessToken(user: User): Promise<string> {
    // Access Token 只携带用户 ID。用户名、邮箱变化后无需重新签发身份内容。
    const payload: AccessTokenPayload = {
      sub: user.id,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.getOrThrow('ACCESS_TOKEN_TTL'),
      secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }

  private invalidCredentials(): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_INVALID_CREDENTIALS', '邮箱或密码错误');
  }

  private normalizeEmail(email: string): string {
    // 登录标识统一为小写并去空格，避免同一邮箱出现多种写法。
    return email.trim().toLowerCase();
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
