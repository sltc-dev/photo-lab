import { PhotoKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialPhotosService } from './material-photos.service';

describe('MaterialPhotosService', () => {
  it('filters project photos by the requested photo kind', async () => {
    const projectFindFirst = vi.fn().mockResolvedValue({ id: 'project-1' });
    const photoFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      photo: {
        findMany: photoFindMany,
      },
      project: {
        findFirst: projectFindFirst,
      },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(
      service.listProjectPhotos(
        'project-1',
        {
          kind: PhotoKind.EDITED,
          limit: 24,
        },
        'current-user',
      ),
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(photoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: PhotoKind.EDITED,
          projectId: 'project-1',
        },
      }),
    );
  });
});
