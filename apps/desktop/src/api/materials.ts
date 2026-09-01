import {
  favoriteMaterialPhoto,
  createMaterialPhotoComment,
  deleteMaterialPhotoComment,
  deleteSticker,
  likeMaterialPhoto,
  listFavoritePhotos,
  listProjectPhotos,
  listUserProjects,
  listUsers,
  listStickers,
  listMaterialPhotoComments,
  type MaterialCommentDto,
  type MaterialPhotoDto,
  type MaterialPhotoPageDto,
  type MaterialUserDto,
  type PhotoKind,
  type ProjectDto,
  unfavoriteMaterialPhoto,
  unlikeMaterialPhoto,
  uploadSticker,
  type MaterialStickerDto,
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
export type MaterialStickerKey = string;

export const materialUsersQueryKey = ['materials', 'users'] as const;
export const materialUserProjectsQueryKey = (userId: string) =>
  ['materials', 'users', userId, 'projects'] as const;
export const materialProjectPhotosQueryKey = (projectId: string, kind: MaterialPhotoKind) =>
  ['materials', 'projects', projectId, 'photos', kind] as const;
export const materialFavoritePhotosQueryKey = (kind: MaterialPhotoKind) =>
  ['materials', 'favorites', kind] as const;
export const materialPhotoCommentsQueryKey = (photoId: string) =>
  ['materials', 'photos', photoId, 'comments'] as const;
export const materialStickersQueryKey = ['materials', 'stickers'] as const;

export async function getMaterialStickers(): Promise<MaterialStickerDto[]> {
  const response = await listStickers({ throwOnError: true });
  return response.data.map((item) => ({ ...item, url: resolveApiUrl(item.url) }));
}

export async function uploadMaterialSticker(file: File): Promise<MaterialStickerDto> {
  const response = await uploadSticker({ body: { file }, throwOnError: true });
  return { ...response.data, url: resolveApiUrl(response.data.url) };
}

export async function deleteMaterialSticker(stickerId: string): Promise<void> {
  await deleteSticker({ path: { stickerId }, throwOnError: true });
}

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

export async function getMaterialPhotoComments(photoId: string): Promise<MaterialCommentDto[]> {
  const response = await listMaterialPhotoComments({ path: { photoId }, throwOnError: true });
  return response.data;
}

export async function addMaterialPhotoComment(
  photoId: string,
  comment: { content: string } | { stickerKey: MaterialStickerKey },
) {
  const response = await createMaterialPhotoComment({
    body: comment,
    path: { photoId },
    throwOnError: true,
  });
  return response.data;
}

export async function removeMaterialPhotoComment(commentId: string) {
  await deleteMaterialPhotoComment({ path: { commentId }, throwOnError: true });
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
      commentCount: Number.isFinite(photo.commentCount) ? photo.commentCount : 0,
      originalUrl: resolveApiUrl(photo.originalUrl),
    })),
  };
}
