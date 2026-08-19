import {
  getEditedPhotoState,
  getOriginalPhoto,
  getThumbnailPhoto,
  listPhotos,
  saveEditedPhoto,
  uploadPhoto,
  type PhotoDto,
  type PhotoKind,
  type PhotoPageDto,
} from '../generated/api';
import { resolveApiUrl } from './http';

export const PROJECT_PHOTOS_PAGE_SIZE = 12;

export type ProjectPhoto = Omit<PhotoDto, 'originalUrl' | 'thumbnailUrl'> & {
  originalUrl: string;
  thumbnailUrl: string;
};

export type ProjectPhotoPage = Omit<PhotoPageDto, 'items'> & {
  items: ProjectPhoto[];
};

export type ProjectPhotoKind = PhotoKind;

export const photosQueryKey = (projectId: string) => ['projects', projectId, 'photos'] as const;
export const projectPhotosByKindQueryKey = (projectId: string, kind: ProjectPhotoKind) =>
  [...photosQueryKey(projectId), kind] as const;
export const photoThumbnailQueryKey = (projectId: string, photoId: string) =>
  ['projects', projectId, 'photos', photoId, 'thumbnail'] as const;
export const photoEditorSourceQueryKey = (projectId: string, photoId: string) =>
  ['projects', projectId, 'photos', photoId, 'editor-source'] as const;

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
  kind: ProjectPhotoKind,
): Promise<ProjectPhotoPage> {
  const response = await listPhotos({
    path: {
      projectId,
    },
    query: {
      ...(cursor ? { cursor } : {}),
      kind,
      limit: PROJECT_PHOTOS_PAGE_SIZE,
    },
    throwOnError: true,
  });

  return {
    ...response.data,
    items: response.data.items.map(resolvePhotoUrls),
  };
}

export async function getPhotoThumbnail(projectId: string, photoId: string): Promise<Blob> {
  const response = await getThumbnailPhoto({
    parseAs: 'blob',
    path: {
      photoId,
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}

export async function getPhotoEditorSource(
  projectId: string,
  photoId: string,
): Promise<{ blob: Blob; editState: Record<string, unknown> | null }> {
  const [stateResponse, imageResponse] = await Promise.all([
    getEditedPhotoState({
      path: {
        photoId,
        projectId,
      },
      throwOnError: true,
    }),
    getOriginalPhoto({
      parseAs: 'blob',
      path: {
        photoId,
        projectId,
      },
      throwOnError: true,
    }),
  ]);
  const editState = sanitizeEditState(stateResponse.data.editState);

  return {
    blob: imageResponse.data,
    editState,
  };
}

export async function saveProjectPhotoEdit(input: {
  editState: Record<string, unknown>;
  file: File;
  finalize: boolean;
  photoId: string;
  projectId: string;
}): Promise<void> {
  await saveEditedPhoto({
    body: {
      editState: JSON.stringify(sanitizeEditState(input.editState)),
      file: input.file,
      finalize: input.finalize,
    },
    path: {
      photoId: input.photoId,
      projectId: input.projectId,
    },
    throwOnError: true,
  });
}

function sanitizeEditState(
  editState: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!editState) {
    return null;
  }

  const sanitized = { ...editState };
  delete sanitized.imgSrc;
  return sanitized;
}

function resolvePhotoUrls(photo: PhotoDto): ProjectPhoto {
  return {
    ...photo,
    originalUrl: resolveApiUrl(photo.originalUrl),
    thumbnailUrl: resolveApiUrl(photo.thumbnailUrl),
  };
}
