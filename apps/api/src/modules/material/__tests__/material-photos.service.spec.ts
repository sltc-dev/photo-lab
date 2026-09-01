import { PhotoKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { MaterialPhotosService } from '../material-photos.service';

describe('MaterialPhotosService', () => {
  it('filters project photos by the requested photo kind', async () => {
    const projectFindFirst = vi.fn().mockResolvedValue({ id: 'project-1' });
    const photoFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      photo: { findMany: photoFindMany },
      project: { findFirst: projectFindFirst },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(
      service.listProjectPhotos('project-1', { kind: PhotoKind.EDITED, limit: 24 }, 'current-user'),
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(photoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: PhotoKind.EDITED, projectId: 'project-1' } }),
    );
  });

  it('creates a like and increments its display count in one transaction', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ likeCount: 7 });
    const transaction = vi.fn(async (callback) =>
      callback({ photoLike: { createMany }, photo: { update } }),
    );
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.likePhoto('photo-1', 'current-user')).resolves.toEqual({
      isLiked: true,
      likeCount: 7,
      photoId: 'photo-1',
    });
    expect(createMany).toHaveBeenCalledWith({
      data: { photoId: 'photo-1', userId: 'current-user' },
      skipDuplicates: true,
    });
    expect(update).toHaveBeenCalledWith({
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
      where: { id: 'photo-1' },
    });
  });

  it('does not increment the count for a repeated like', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ likeCount: 7 });
    const update = vi.fn();
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      $transaction: vi.fn(async (callback) =>
        callback({ photoLike: { createMany }, photo: { findUniqueOrThrow, update } }),
      ),
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.likePhoto('photo-1', 'current-user')).resolves.toMatchObject({
      isLiked: true,
      likeCount: 7,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a favorite and increments its display count in one transaction', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      $transaction: vi.fn(async (callback) =>
        callback({ photoFavorite: { createMany }, photo: { update } }),
      ),
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.favoritePhoto('photo-1', 'current-user')).resolves.toEqual({
      isFavorited: true,
      photoId: 'photo-1',
    });
    expect(update).toHaveBeenCalledWith({
      data: { favoriteCount: { increment: 1 } },
      where: { id: 'photo-1' },
    });
  });

  it('removes a like and decrements its display count in one transaction', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ likeCount: 6 });
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      $transaction: vi.fn(async (callback) =>
        callback({ photoLike: { deleteMany }, photo: { update } }),
      ),
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.unlikePhoto('photo-1', 'current-user')).resolves.toEqual({
      isLiked: false,
      likeCount: 6,
      photoId: 'photo-1',
    });
    expect(update).toHaveBeenCalledWith({
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
      where: { id: 'photo-1' },
    });
  });

  it('removes a favorite and decrements its display count in one transaction', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      $transaction: vi.fn(async (callback) =>
        callback({ photoFavorite: { deleteMany }, photo: { update } }),
      ),
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.unfavoritePhoto('photo-1', 'current-user')).resolves.toEqual({
      isFavorited: false,
      photoId: 'photo-1',
    });
    expect(update).toHaveBeenCalledWith({
      data: { favoriteCount: { decrement: 1 } },
      where: { id: 'photo-1' },
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

  it('creates an emoji comment for a material photo', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'comment-1',
      photoId: 'photo-1',
      userId: 'current-user',
      content: '太棒了 🎉',
      stickerKey: null,
      stickerUrl: null,
      createdAt: new Date('2026-08-31T01:00:00.000Z'),
      user: { id: 'current-user', username: '小李' },
    });
    const prisma = {
      photo: { findFirst: vi.fn().mockResolvedValue({ id: 'photo-1' }) },
      photoComment: { create },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(
      service.createComment('photo-1', 'current-user', { content: '太棒了 🎉' }),
    ).resolves.toEqual({
      id: 'comment-1',
      photoId: 'photo-1',
      author: { id: 'current-user', userName: '小李' },
      content: '太棒了 🎉',
      stickerKey: null,
      stickerUrl: null,
      canDelete: true,
      createdAt: '2026-08-31T01:00:00.000Z',
    });
  });

  it('only deletes comments owned by the current user', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      photoComment: {
        delete: remove,
        findFirst: vi.fn().mockResolvedValue({
          userId: 'current-user',
          photo: { project: { userId: 'photo-owner' } },
        }),
      },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.deleteComment('comment-1', 'current-user')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
  });

  it('allows the photo owner to delete another users comment', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      photoComment: {
        delete: remove,
        findFirst: vi.fn().mockResolvedValue({
          userId: 'comment-author',
          photo: { project: { userId: 'photo-owner' } },
        }),
      },
    } as unknown as PrismaService;
    const service = new MaterialPhotosService(prisma);

    await expect(service.deleteComment('comment-1', 'photo-owner')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
  });
});
