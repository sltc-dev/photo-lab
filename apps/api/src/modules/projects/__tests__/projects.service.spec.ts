import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectsService } from '../projects.service';

const projectRecord = {
  _count: {
    photos: 3,
  },
  createdAt: new Date('2026-07-27T08:00:00.000Z'),
  description: '夏季旅行照片',
  id: 'project-1',
  name: '2026 夏季旅行',
  updatedAt: new Date('2026-07-27T09:00:00.000Z'),
};

function createService(result: typeof projectRecord | null): {
  findFirst: ReturnType<typeof vi.fn>;
  service: ProjectsService;
} {
  const findFirst = vi.fn().mockResolvedValue(result);
  const prisma = {
    project: {
      findFirst,
    },
  } as unknown as PrismaService;

  return {
    findFirst,
    service: new ProjectsService(prisma),
  };
}

describe('ProjectsService.getProject', () => {
  it('returns an owned project using the public project shape', async () => {
    const { findFirst, service } = createService(projectRecord);

    await expect(service.getProject('user-1', 'project-1')).resolves.toEqual({
      createdAt: '2026-07-27T08:00:00.000Z',
      description: '夏季旅行照片',
      id: 'project-1',
      name: '2026 夏季旅行',
      photoCount: 3,
      updatedAt: '2026-07-27T09:00:00.000Z',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'project-1',
          userId: 'user-1',
        },
      }),
    );
  });

  it('returns the same not-found response for missing or unowned projects', async () => {
    const { service } = createService(null);

    try {
      await service.getProject('user-1', 'project-owned-by-another-user');
      throw new Error('Expected PROJECT_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect((error as AppException).getResponse()).toEqual({
        code: 'PROJECT_NOT_FOUND',
        details: null,
        message: '图库项目不存在',
      });
    }
  });
});
