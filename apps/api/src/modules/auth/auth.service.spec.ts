import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RefreshToken, User } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

type RefreshTokenWithUser = RefreshToken & {
  user: User;
};

// 轻量内存版 Prisma，只实现 AuthService 测试真正使用的方法。
// 它适合验证业务分支，但不能替代真实 PostgreSQL 的迁移、约束和并发测试。
class FakeAuthPrisma {
  refreshTokens: RefreshToken[] = [];
  users: User[] = [];
  private refreshSeq = 0;
  private userSeq = 0;

  user = {
    create: async (args: {
      data: Pick<User, 'email' | 'passwordHash' | 'username'>;
    }): Promise<User> => {
      if (this.users.some((user) => user.email === args.data.email)) {
        throw { code: 'P2002' };
      }

      const now = new Date();
      const user: User = {
        createdAt: now,
        email: args.data.email,
        id: `user-${(this.userSeq += 1)}`,
        passwordHash: args.data.passwordHash,
        updatedAt: now,
        username: args.data.username,
      };

      this.users.push(user);
      return user;
    },
    findUnique: async (args: { where: { email?: string; id?: string } }): Promise<User | null> => {
      return (
        this.users.find((user) => user.email === args.where.email || user.id === args.where.id) ??
        null
      );
    },
  };

  refreshToken = {
    create: async (args: {
      data: Pick<RefreshToken, 'expiresAt' | 'tokenHash' | 'userId'>;
    }): Promise<RefreshToken> => {
      const refreshToken: RefreshToken = {
        createdAt: new Date(),
        expiresAt: args.data.expiresAt,
        id: `refresh-${(this.refreshSeq += 1)}`,
        revokedAt: null,
        tokenHash: args.data.tokenHash,
        userId: args.data.userId,
      };

      this.refreshTokens.push(refreshToken);
      return refreshToken;
    },
    findUnique: async (args: {
      include?: { user: true };
      where: { tokenHash: string };
    }): Promise<RefreshTokenWithUser | RefreshToken | null> => {
      const token = this.refreshTokens.find((item) => item.tokenHash === args.where.tokenHash);

      if (!token) {
        return null;
      }

      if (args.include?.user) {
        const user = this.users.find((item) => item.id === token.userId);
        return user ? { ...token, user } : null;
      }

      return token;
    },
    updateMany: async (args: {
      data: { revokedAt: Date };
      where: { revokedAt?: null; tokenHash?: string; userId?: string };
    }): Promise<{ count: number }> => {
      let count = 0;

      for (const token of this.refreshTokens) {
        const matchesTokenHash =
          args.where.tokenHash === undefined || token.tokenHash === args.where.tokenHash;
        const matchesUserId = args.where.userId === undefined || token.userId === args.where.userId;
        const matchesRevoked =
          args.where.revokedAt === undefined || token.revokedAt === args.where.revokedAt;

        if (matchesTokenHash && matchesUserId && matchesRevoked) {
          token.revokedAt = args.data.revokedAt;
          count += 1;
        }
      }

      return { count };
    },
  };

  async $transaction<T>(operation: (tx: this) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

function createService(fakePrisma = new FakeAuthPrisma()): {
  fakePrisma: FakeAuthPrisma;
  service: AuthService;
} {
  // 手动组装 Service 依赖，让单元测试不需要启动整个 Nest 应用。
  const env: AppEnv = {
    ACCESS_TOKEN_TTL: '15m',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_ACCESS_SECRET: 'test-access-secret-123',
    JWT_REFRESH_SECRET: 'test-refresh-secret-123',
    NODE_ENV: 'test',
    PORT: 3000,
    REFRESH_TOKEN_TTL: '30d',
    THROTTLE_LIMIT: 120,
    THROTTLE_TTL_MS: 60_000,
  };
  const configService = {
    getOrThrow: <K extends keyof AppEnv>(key: K): AppEnv[K] => env[key],
  } as unknown as ConfigService<AppEnv, true>;
  const prismaService = fakePrisma as unknown as PrismaService;
  const usersService = new UsersService(prismaService);
  const service = new AuthService(prismaService, new JwtService(), configService, usersService);

  return { fakePrisma, service };
}

async function expectAppCode(promise: Promise<unknown>, code: string): Promise<void> {
  // 统一断言 AppException 的稳定业务错误码，避免每个测试重复 try/catch。
  try {
    await promise;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getResponse()).toMatchObject({ code });
  }
}

describe('AuthService', () => {
  it('registers every user with the same public user shape and hashes the password', async () => {
    const { fakePrisma, service } = createService();

    const first = await service.register({
      email: 'first@example.com',
      password: 'password123',
      username: 'First',
    });
    const second = await service.register({
      email: 'second@example.com',
      password: 'password123',
      username: 'Second',
    });

    expect(first.user).not.toHaveProperty('role');
    expect(second.user).not.toHaveProperty('role');
    expect(fakePrisma.users[0]?.passwordHash).not.toBe('password123');
    expect(fakePrisma.refreshTokens).toHaveLength(2);
  });

  it('normalizes email and username before persistence', async () => {
    const { fakePrisma, service } = createService();

    await service.register({
      email: '  User@Example.com ',
      password: 'password123',
      username: '  User  ',
    });

    expect(fakePrisma.users[0]).toMatchObject({
      email: 'user@example.com',
      username: 'User',
    });
  });

  it('returns a stable conflict for duplicate email addresses', async () => {
    const { service } = createService();

    await service.register({
      email: 'user@example.com',
      password: 'password123',
      username: 'User',
    });

    await expectAppCode(
      service.register({
        email: 'USER@example.com',
        password: 'password123',
        username: 'Another User',
      }),
      'USER_EMAIL_ALREADY_EXISTS',
    );
  });

  it('returns the same credential error for missing users and bad passwords', async () => {
    const { service } = createService();

    await expectAppCode(
      service.login({ email: 'missing@example.com', password: 'password123' }),
      'AUTH_INVALID_CREDENTIALS',
    );
    await service.register({
      email: 'user@example.com',
      password: 'password123',
      username: 'User',
    });
    await expectAppCode(
      service.login({ email: 'user@example.com', password: 'wrong-password' }),
      'AUTH_INVALID_CREDENTIALS',
    );
  });

  it('rotates refresh tokens and rejects revoked tokens', async () => {
    const { fakePrisma, service } = createService();
    const registered = await service.register({
      email: 'user@example.com',
      password: 'password123',
      username: 'User',
    });

    const refreshed = await service.refresh({ refreshToken: registered.refreshToken });

    expect(refreshed.refreshToken).not.toBe(registered.refreshToken);
    expect(fakePrisma.refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
    await expectAppCode(
      service.refresh({ refreshToken: registered.refreshToken }),
      'AUTH_REFRESH_TOKEN_INVALID',
    );
  });
});
