import {
  favoriteMaterialPhoto,
  likeMaterialPhoto,
  listFavoritePhotos,
  listProjectPhotos,
  listUserProjects,
  listUsers,
  type MaterialPhotoDto,
  type MaterialPhotoPageDto,
  type MaterialUserDto,
  type PhotoKind,
  type ProjectDto,
  unfavoriteMaterialPhoto,
  unlikeMaterialPhoto,
} from '../generated/api';
import { resolveApiUrl } from './http';

export const MATERIAL_PHOTOS_PAGE_SIZE = 24;
export const MATERIAL_QUERY_STALE_TIME = 60_000;

export type MaterialPhoto = Omit<MaterialPhotoDto, 'originalUrl'> & {
  originalUrl: string;
};

export type MaterialPhotoPage = Omit<MaterialPhotoPageDto, 'items'> & {
  items: MaterialPhoto[];
};

export type MaterialPhotoKind = PhotoKind;

export const materialUsersQueryKey = ['materials', 'users'] as const;
export const materialUserProjectsQueryKey = (userId: string) =>
  ['materials', 'users', userId, 'projects'] as const;
export const materialProjectPhotosQueryKey = (projectId: string, kind: MaterialPhotoKind) =>
  ['materials', 'projects', projectId, 'photos', kind] as const;
export const materialFavoritePhotosQueryKey = (kind: MaterialPhotoKind) =>
  ['materials', 'favorites', kind] as const;

export async function getMaterialUsers(): Promise<MaterialUserDto[]> {
  const response = await listUsers({
    throwOnError: true,
  });

  return response.data;
}

export async function getMaterialFavoritePhotosPage(
  cursor: string | null,
  kind: MaterialPhotoKind,
): Promise<MaterialPhotoPage> {
  const response = await listFavoritePhotos({
    query: {
      ...(cursor ? { cursor } : {}),
      kind,
      limit: MATERIAL_PHOTOS_PAGE_SIZE,
    },
    throwOnError: true,
  });

  return resolveMaterialPhotoPage(response.data);
}

export async function setMaterialPhotoLike(photoId: string, isLiked: boolean) {
  const request = isLiked ? likeMaterialPhoto : unlikeMaterialPhoto;
  const response = await request({ path: { photoId }, throwOnError: true });
  return response.data;
}

export async function setMaterialPhotoFavorite(photoId: string, isFavorited: boolean) {
  const request = isFavorited ? favoriteMaterialPhoto : unfavoriteMaterialPhoto;
  const response = await request({ path: { photoId }, throwOnError: true });
  return response.data;
}

export async function getMaterialUserProjects(userId: string): Promise<ProjectDto[]> {
  const response = await listUserProjects({
    path: {
      userId,
    },
    throwOnError: true,
  });

  return response.data;
}

export async function getMaterialProjectPhotosPage(
  projectId: string,
  cursor: string | null,
  kind: MaterialPhotoKind,
): Promise<MaterialPhotoPage> {
  const response = await listProjectPhotos({
    path: {
      projectId,
    },
    query: {
      ...(cursor ? { cursor } : {}),
      kind,
      limit: MATERIAL_PHOTOS_PAGE_SIZE,
    },
    throwOnError: true,
  });

  return resolveMaterialPhotoPage(response.data);
}

function resolveMaterialPhotoPage(page: MaterialPhotoPageDto): MaterialPhotoPage {
  return {
    ...page,
    items: page.items.map((photo) => ({
      ...photo,
      originalUrl: resolveApiUrl(photo.originalUrl),
    })),
  };
}
