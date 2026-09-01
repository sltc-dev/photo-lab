import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListMaterialPhotosQueryDto,
  MaterialPhotoFavoriteStateDto,
  MaterialPhotoDto,
  MaterialPhotoLikeStateDto,
  MaterialPhotoPageDto,
} from './dto/material-photo.dto';
import { AppException } from '../../common/errors/app.exception';
import { buildPublicUrl } from '../storage/storage-url.util';
import { ProjectDto } from '../projects/dto/project.dto';
import {
  CreateMaterialCommentDto,
  MATERIAL_STICKER_KEYS,
  MaterialCommentDto,
} from './dto/material-comment.dto';

const materialProjectSelect = {
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

const materialUserProjectsSelect = {
  projects: {
    orderBy: {
      createdAt: 'desc',
    },
    select: materialProjectSelect,
  },
} satisfies Prisma.UserSelect;

const materialPhotoSelect = (currentUserId: string) =>
  ({
    id: true,
    projectId: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    width: true,
    height: true,
    kind: true,
    originalObjectKey: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    project: {
      select: {
        name: true,
      },
    },
    likes: {
      select: { userId: true },
      where: { userId: currentUserId },
    },
    favorites: {
      select: { userId: true },
      where: { userId: currentUserId },
    },
    likeCount: true,
    _count: {
      select: { comments: true },
    },
  }) satisfies Prisma.PhotoSelect;

type MaterialProjectRecord = Prisma.ProjectGetPayload<{
  select: typeof materialProjectSelect;
}>;

type MaterialPhotoRecord = Prisma.PhotoGetPayload<{
  select: ReturnType<typeof materialPhotoSelect>;
}>;

@Injectable()
export class MaterialPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserProjects(userId: string, currentUserId: string): Promise<ProjectDto[]> {
    const user = await this.prisma.user.findFirst({
      select: materialUserProjectsSelect,
      where: {
        id: userId,
        NOT: {
          id: currentUserId,
        },
      },
    });
    if (!user) {
      throw new AppException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', '用户不存在');
    }

    return user.projects.map((project) => this.toProjectDto(project));
  }

  async listProjectPhotos(
    projectId: string,
    query: ListMaterialPhotosQueryDto,
    currentUserId: string,
  ): Promise<MaterialPhotoPageDto> {
    const project = await this.prisma.project.findFirst({
      select: {
        id: true,
      },
      where: {
        id: projectId,
        userId: {
          not: currentUserId,
        },
      },
    });
    if (!project) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PROJECT_NOT_FOUND', '图库项目不存在');
    }

    return this.listPhotos(query, currentUserId, { projectId });
  }

  async listFavoritePhotos(
    query: ListMaterialPhotosQueryDto,
    currentUserId: string,
  ): Promise<MaterialPhotoPageDto> {
    return this.listPhotos(query, currentUserId, {
      favorites: {
        some: { userId: currentUserId },
      },
      project: {
        userId: { not: currentUserId },
      },
    });
  }

  async likePhoto(photoId: string, currentUserId: string): Promise<MaterialPhotoLikeStateDto> {
    //先检查图片是否允许操作
    await this.ensureMaterialPhoto(photoId, currentUserId);
    //
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.photoLike.createMany({
        data: { photoId, userId: currentUserId },
        skipDuplicates: true,
      });
      const photo =
        result.count > 0
          ? await tx.photo.update({
              data: { likeCount: { increment: 1 } },
              select: { likeCount: true },
              where: { id: photoId },
            })
          : await tx.photo.findUniqueOrThrow({
              select: { likeCount: true },
              where: { id: photoId },
            });

      return { photoId, isLiked: true, likeCount: photo.likeCount };
    });
  }

  async unlikePhoto(photoId: string, currentUserId: string): Promise<MaterialPhotoLikeStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.photoLike.deleteMany({
        where: { photoId, userId: currentUserId },
      });
      const photo =
        result.count > 0
          ? await tx.photo.update({
              data: { likeCount: { decrement: 1 } },
              select: { likeCount: true },
              where: { id: photoId },
            })
          : await tx.photo.findUniqueOrThrow({
              select: { likeCount: true },
              where: { id: photoId },
            });

      return { photoId, isLiked: false, likeCount: photo.likeCount };
    });
  }

  async favoritePhoto(
    photoId: string,
    currentUserId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.photoFavorite.createMany({
        data: { photoId, userId: currentUserId },
        skipDuplicates: true,
      });
      if (result.count > 0) {
        await tx.photo.update({
          data: { favoriteCount: { increment: 1 } },
          where: { id: photoId },
        });
      }

      return { photoId, isFavorited: true };
    });
  }

  async unfavoritePhoto(
    photoId: string,
    currentUserId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.photoFavorite.deleteMany({
        where: { photoId, userId: currentUserId },
      });
      if (result.count > 0) {
        await tx.photo.update({
          data: { favoriteCount: { decrement: 1 } },
          where: { id: photoId },
        });
      }

      return { photoId, isFavorited: false };
    });
  }

  async listComments(photoId: string, currentUserId: string): Promise<MaterialCommentDto[]> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    const comments = await this.prisma.photoComment.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        photoId: true,
        userId: true,
        content: true,
        stickerKey: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
        photo: { select: { project: { select: { userId: true } } } },
      },
      where: { photoId },
    });

    const customIds = comments
      .map((comment) => comment.stickerKey)
      .filter((key): key is string =>
        Boolean(key && !MATERIAL_STICKER_KEYS.includes(key as never)),
      );
    const stickers = await this.prisma.userSticker.findMany({ where: { id: { in: customIds } } });
    const stickerUrls = new Map(stickers.map((item) => [item.id, buildPublicUrl(item.objectKey)]));
    return comments.map((comment) => ({
      id: comment.id,
      photoId: comment.photoId,
      author: { id: comment.user.id, userName: comment.user.username },
      content: comment.content,
      stickerKey: comment.stickerKey ?? null,
      stickerUrl: comment.stickerKey ? (stickerUrls.get(comment.stickerKey) ?? null) : null,
      canDelete: comment.userId === currentUserId || comment.photo.project.userId === currentUserId,
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  async createComment(
    photoId: string,
    currentUserId: string,
    dto: CreateMaterialCommentDto,
  ): Promise<MaterialCommentDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    const hasContent = Boolean(dto.content);
    const hasSticker = Boolean(dto.stickerKey);
    if (hasContent === hasSticker) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', '请选择文字或表情包发送');
    }
    if (dto.stickerKey && !MATERIAL_STICKER_KEYS.includes(dto.stickerKey as never)) {
      const customSticker = await this.prisma.userSticker.findFirst({
        where: { deletedAt: null, id: dto.stickerKey, userId: currentUserId },
      });
      if (!customSticker)
        throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', '表情包不存在');
    }
    const comment = await this.prisma.photoComment.create({
      data: {
        content: dto.content ?? null,
        photoId,
        stickerKey: dto.stickerKey ?? null,
        userId: currentUserId,
      },
      select: {
        id: true,
        photoId: true,
        userId: true,
        content: true,
        stickerKey: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
      },
    });

    return {
      id: comment.id,
      photoId: comment.photoId,
      author: { id: comment.user.id, userName: comment.user.username },
      content: comment.content,
      stickerKey: comment.stickerKey,
      stickerUrl:
        dto.stickerKey && !MATERIAL_STICKER_KEYS.includes(dto.stickerKey as never)
          ? buildPublicUrl(`stickers/${currentUserId}/${dto.stickerKey}.webp`)
          : null,
      canDelete: true,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async deleteComment(commentId: string, currentUserId: string): Promise<void> {
    const comment = await this.prisma.photoComment.findFirst({
      select: { photo: { select: { project: { select: { userId: true } } } }, userId: true },
      where: { id: commentId },
    });
    if (
      !comment ||
      (comment.userId !== currentUserId && comment.photo.project.userId !== currentUserId)
    ) {
      throw new AppException(HttpStatus.NOT_FOUND, 'COMMENT_NOT_FOUND', '评论不存在');
    }
    await this.prisma.photoComment.delete({ where: { id: commentId } });
  }

  private async listPhotos(
    query: ListMaterialPhotosQueryDto,
    currentUserId: string,
    where: Prisma.PhotoWhereInput,
  ): Promise<MaterialPhotoPageDto> {
    const photos = await this.prisma.photo.findMany({
      ...(query.cursor
        ? {
            cursor: {
              id: query.cursor,
            },
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: materialPhotoSelect(currentUserId),
      //如果有cursor，那么应当跳过上一页的最后一个数据
      skip: query.cursor ? 1 : 0,
      //取比当前页多一条的数据，判断是否还有下一页
      take: query.limit + 1,
      where: {
        ...where,
        ...(query.kind ? { kind: query.kind } : {}),
      },
    });

    //判断是否还有下一页
    const hasMore = photos.length > query.limit;

    const pageItems = hasMore ? photos.slice(0, query.limit) : photos;

    return {
      items: pageItems.map((photo) => this.toMaterialPhotoDto(photo)),
      nextCursor: hasMore ? pageItems.at(-1)!.id : null,
    };
  }

  private async ensureMaterialPhoto(photoId: string, currentUserId: string): Promise<void> {
    const photo = await this.prisma.photo.findFirst({
      select: { id: true },
      where: {
        id: photoId,
        project: { userId: { not: currentUserId } },
      },
    });
    if (!photo) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PHOTO_NOT_FOUND', '素材图片不存在');
    }
  }

  private toProjectDto(project: MaterialProjectRecord): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      photoCount: project._count.photos,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toMaterialPhotoDto(photo: MaterialPhotoRecord): MaterialPhotoDto {
    return {
      id: photo.id,
      projectId: photo.projectId,
      projectName: photo.project.name,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      originalUrl: buildPublicUrl(photo.originalObjectKey),
      sizeBytes: photo.sizeBytes,
      width: photo.width,
      height: photo.height,
      kind: photo.kind,
      status: photo.status,
      isLiked: photo.likes.length > 0,
      likeCount: photo.likeCount,
      isFavorited: photo.favorites.length > 0,
      commentCount: photo._count.comments,
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }
}
