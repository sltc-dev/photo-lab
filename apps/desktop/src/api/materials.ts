import {
  listProjectPhotos,
  listUserProjects,
  listUsers,
  type MaterialPhotoDto,
  type MaterialPhotoPageDto,
  type MaterialUserDto,
  type ProjectDto,
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

export const materialUsersQueryKey = ['materials', 'users'] as const;
export const materialUserProjectsQueryKey = (userId: string) =>
  ['materials', 'users', userId, 'projects'] as const;
export const materialProjectPhotosQueryKey = (projectId: string) =>
  ['materials', 'projects', projectId, 'photos'] as const;

export async function getMaterialUsers(): Promise<MaterialUserDto[]> {
  const response = await listUsers({
    throwOnError: true,
  });

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
): Promise<MaterialPhotoPage> {
  const response = await listProjectPhotos({
    path: {
      projectId,
    },
    query: {
      ...(cursor ? { cursor } : {}),
      limit: MATERIAL_PHOTOS_PAGE_SIZE,
    },
    throwOnError: true,
  });

  return {
    ...response.data,
    items: response.data.items.map((photo) => ({
      ...photo,
      originalUrl: resolveApiUrl(photo.originalUrl),
    })),
  };
}
