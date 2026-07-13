import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserDto } from './dto/current-user.dto';

type PublicUserRecord = Pick<User, 'createdAt' | 'email' | 'id' | 'updatedAt' | 'username'>;

@Injectable()
/** 统一控制哪些用户字段可以离开后端，避免业务代码意外返回 passwordHash。 */
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicUser(userId: string): Promise<CurrentUserDto | null> {
    // select 在数据库查询阶段就排除 passwordHash，而不是查出来后再删除。
    const user = await this.prisma.user.findUnique({
      select: {
        createdAt: true,
        email: true,
        id: true,
        updatedAt: true,
        username: true,
      },
      where: {
        id: userId,
      },
    });

    return user ? this.toPublicUser(user) : null;
  }

  toPublicUser(user: PublicUserRecord): CurrentUserDto {
    // DTO 使用 JSON 友好的 ISO 字符串，避免 Date 在不同进程间产生隐式转换差异。
    return {
      createdAt: user.createdAt.toISOString(),
      email: user.email,
      id: user.id,
      updatedAt: user.updatedAt.toISOString(),
      username: user.username,
    };
  }
}
