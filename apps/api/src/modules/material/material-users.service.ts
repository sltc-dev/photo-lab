import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialUserDto } from './dto/material-user.dto';

//定义查询字段配置，对应数据库字段
const materialUserSelect = {
  id: true,
  username: true,
  _count: {
    select: {
      projects: true,
    },
  },
} satisfies Prisma.UserSelect;

//根据前面的代码自动推到出Prisma的查询结果
//
type MaterialUserRecord = Prisma.UserGetPayload<{
  select: typeof materialUserSelect;
}>;

//prisma是一个orm库，这里是在操作数据库

//Injectable标记为可注入的provider
@Injectable()
export class MaterialUserService {
  constructor(private readonly prisma: PrismaService) {}
  async listUsers(currentUserId: string): Promise<MaterialUserDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: [
        {
          username: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: materialUserSelect,
      where: {
        id: {
          not: currentUserId,
        },
      },
    });
    return users.map((user) => this.toMaterialUserDto(user));
  }
  private toMaterialUserDto(user: MaterialUserRecord): MaterialUserDto {
    return {
      id: user.id,
      userName: user.username,
      projectCount: user._count.projects,
    };
  }
}
