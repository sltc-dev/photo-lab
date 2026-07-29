import {
  getOriginalPhoto,
  getThumbnailPhoto,
  listPhotos,
  uploadPhoto,
  type PhotoDto,
} from '../generated/api';

export type ProjectPhoto = PhotoDto;

export const photosQueryKey = (projectId: string) => ['projects', projectId, 'photos'] as const;
export const photoOriginalQueryKey = (projectId: string, photoId: string) =>
  ['projects', projectId, 'photos', photoId, 'original'] as const;
export const photoThumbnailQueryKey = (projectId: string, photoId: string) =>
  ['projects', projectId, 'photos', photoId, 'thumbnail'] as const;

export type UploadProjectPhotoInput = {
  file: File;
  projectId: string;
};

export async function uploadProjectPhoto({
  file,
  projectId,
}: UploadProjectPhotoInput): Promise<PhotoDto> {
  const response = await uploadPhoto({
    body: {
      file,
    },
    path: {
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}

export async function getProjectPhotos(projectId: string): Promise<PhotoDto[]> {
  const response = await listPhotos({
    path: {
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}

export async function getPhotoOriginal(projectId: string, photoId: string): Promise<Blob> {
  const response = await getOriginalPhoto({
    path: {
      photoId,
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}

export async function getPhotoThumbnail(projectId: string, photoId: string): Promise<Blob> {
  const response = await getThumbnailPhoto({
    path: {
      photoId,
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}
