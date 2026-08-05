import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ProjectDto } from './dto/project.dto';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      photos: true,
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectRecord = Prisma.ProjectGetPayload<{
  select: typeof projectSelect;
}>;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(userId: string, dto: CreateProjectDto): Promise<ProjectDto> {
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
      },
      select: projectSelect,
    });

    return this.toProjectDto(project);
  }

  async listProjects(userId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: projectSelect,
    });

    return projects.map((project) => this.toProjectDto(project));
  }

  async getProject(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: projectSelect,
    });

    if (!project) {
      // 不区分“项目不存在”和“项目属于其他用户”，避免泄露其他用户的资源信息。
      throw new AppException(HttpStatus.NOT_FOUND, 'PROJECT_NOT_FOUND', '图库项目不存在');
    }

    return this.toProjectDto(project);
  }

  private toProjectDto(project: ProjectRecord): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      photoCount: project._count.photos,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
