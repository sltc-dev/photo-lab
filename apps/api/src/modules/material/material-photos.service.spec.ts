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

  it('likes a material photo idempotently and returns the public count', async () => {
    const photoFindFirst = vi.fn().mockResolvedValue({ id: 'photo-1' });
    const photoLikeUpsert = vi.fn().mockResolvedValue({});
    const photoLikeCount = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(7);
    const prisma = {
      photo: { findFirst: photoFindFirst },
      photoLike: { count: photoLikeCount, upsert: photoLikeUpsert },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.likePhoto('photo-1', 'current-user')).resolves.toEqual({
      isLiked: true,
      likeCount: 7,
      photoId: 'photo-1',
    });
    expect(photoLikeUpsert).toHaveBeenCalledWith({
      create: { photoId: 'photo-1', userId: 'current-user' },
      update: {},
      where: { userId_photoId: { photoId: 'photo-1', userId: 'current-user' } },
    });
  });

  it('favorites a material photo independently from likes', async () => {
    const photoFavoriteUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      photoFavorite: { upsert: photoFavoriteUpsert },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.favoritePhoto('photo-1', 'current-user')).resolves.toEqual({
      isFavorited: true,
      photoId: 'photo-1',
    });
    expect(photoFavoriteUpsert).toHaveBeenCalledWith({
      create: { photoId: 'photo-1', userId: 'current-user' },
      update: {},
      where: { userId_photoId: { photoId: 'photo-1', userId: 'current-user' } },
    });
  });

  it('removes a like without changing favorite state', async () => {
    const photoLikeDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const photoLikeCount = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(6);
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      photoLike: { count: photoLikeCount, deleteMany: photoLikeDeleteMany },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.unlikePhoto('photo-1', 'current-user')).resolves.toEqual({
      isLiked: false,
      likeCount: 6,
      photoId: 'photo-1',
    });
    expect(photoLikeDeleteMany).toHaveBeenCalledWith({
      where: { photoId: 'photo-1', userId: 'current-user' },
    });
  });

  it('removes a favorite without changing like state', async () => {
    const photoFavoriteDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      photoFavorite: { deleteMany: photoFavoriteDeleteMany },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.unfavoritePhoto('photo-1', 'current-user')).resolves.toEqual({
      isFavorited: false,
      photoId: 'photo-1',
    });
    expect(photoFavoriteDeleteMany).toHaveBeenCalledWith({
      where: { photoId: 'photo-1', userId: 'current-user' },
    });
  });

  it('lists only the current user favorites', async () => {
    const photoFindMany = vi.fn().mockResolvedValue([]);
    const prisma = { photo: { findMany: photoFindMany } } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(
      service.listFavoritePhotos({ kind: PhotoKind.ORIGINAL, limit: 24 }, 'current-user'),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(photoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          favorites: { some: { userId: 'current-user' } },
          kind: PhotoKind.ORIGINAL,
          project: { userId: { not: 'current-user' } },
        },
      }),
    );
  });
});
