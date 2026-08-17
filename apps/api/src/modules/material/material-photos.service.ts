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
    _count: {
      select: { likes: true },
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
    await this.ensureMaterialPhoto(photoId, currentUserId);
    await this.prisma.photoLike.upsert({
      create: { photoId, userId: currentUserId },
      update: {},
      where: { userId_photoId: { photoId, userId: currentUserId } },
    });

    return this.getLikeState(photoId, currentUserId);
  }

  async unlikePhoto(photoId: string, currentUserId: string): Promise<MaterialPhotoLikeStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    await this.prisma.photoLike.deleteMany({
      where: { photoId, userId: currentUserId },
    });

    return this.getLikeState(photoId, currentUserId);
  }

  async favoritePhoto(
    photoId: string,
    currentUserId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    await this.prisma.photoFavorite.upsert({
      create: { photoId, userId: currentUserId },
      update: {},
      where: { userId_photoId: { photoId, userId: currentUserId } },
    });

    return { photoId, isFavorited: true };
  }

  async unfavoritePhoto(
    photoId: string,
    currentUserId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    await this.ensureMaterialPhoto(photoId, currentUserId);
    await this.prisma.photoFavorite.deleteMany({
      where: { photoId, userId: currentUserId },
    });

    return { photoId, isFavorited: false };
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

  private async getLikeState(
    photoId: string,
    currentUserId: string,
  ): Promise<MaterialPhotoLikeStateDto> {
    const [isLiked, likeCount] = await Promise.all([
      this.prisma.photoLike.count({ where: { photoId, userId: currentUserId } }),
      this.prisma.photoLike.count({ where: { photoId } }),
    ]);

    return { photoId, isLiked: isLiked > 0, likeCount };
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
      likeCount: photo._count.likes,
      isFavorited: photo.favorites.length > 0,
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }
}
