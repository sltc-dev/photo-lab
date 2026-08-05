import { listPhotos, uploadPhoto, type PhotoDto, type PhotoPageDto } from '../generated/api';
import { resolveApiUrl } from './http';

export const PROJECT_PHOTOS_PAGE_SIZE = 12;

export type ProjectPhoto = Omit<PhotoDto, 'originalUrl' | 'thumbnailUrl'> & {
  originalUrl: string;
  thumbnailUrl: string;
};

export type ProjectPhotoPage = Omit<PhotoPageDto, 'items'> & {
  items: ProjectPhoto[];
};

export const photosQueryKey = (projectId: string) => ['projects', projectId, 'photos'] as const;

export type UploadProjectPhotoInput = {
  file: File;
  projectId: string;
};

export async function uploadProjectPhoto({
  file,
  projectId,
}: UploadProjectPhotoInput): Promise<ProjectPhoto> {
  const response = await uploadPhoto({
    body: {
      file,
    },
    path: {
      projectId,
    },
    throwOnError: true,
  });

  return resolvePhotoUrls(response.data);
}

export async function getProjectPhotosPage(
  projectId: string,
  cursor: string | null,
): Promise<ProjectPhotoPage> {
  const response = await listPhotos({
    path: {
      projectId,
    },
    query: {
      ...(cursor ? { cursor } : {}),
      limit: PROJECT_PHOTOS_PAGE_SIZE,
    },
    throwOnError: true,
  });

  return {
    ...response.data,
    items: response.data.items.map(resolvePhotoUrls),
  };
}

function resolvePhotoUrls(photo: PhotoDto): ProjectPhoto {
  return {
    ...photo,
    originalUrl: resolveApiUrl(photo.originalUrl),
    thumbnailUrl: resolveApiUrl(photo.thumbnailUrl),
  };
}
