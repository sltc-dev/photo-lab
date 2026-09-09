import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialPhoto, MaterialPhotoKind } from '../../../src/api/materials';
import { MaterialPhotoGrid } from '../../../src/components/materials/MaterialPhotoGrid';

const apiMocks = vi.hoisted(() => ({
  getMaterialPhotoComments: vi.fn(),
  getMaterialProjectPhotosPage: vi.fn(),
  setMaterialPhotoFavorite: vi.fn(),
  setMaterialPhotoLike: vi.fn(),
}));

vi.mock('../../../src/api/materials', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/materials')>();

  return {
    ...original,
    getMaterialPhotoComments: apiMocks.getMaterialPhotoComments,
    getMaterialProjectPhotosPage: apiMocks.getMaterialProjectPhotosPage,
    setMaterialPhotoFavorite: apiMocks.setMaterialPhotoFavorite,
    setMaterialPhotoLike: apiMocks.setMaterialPhotoLike,
  };
});

const editedPhoto: MaterialPhoto = {
  commentCount: 0,
  createdAt: '2026-08-17T08:00:00.000Z',
  fileName: 'holiday.edited.webp',
  height: 800,
  id: 'photo-edited',
  isFavorited: false,
  isLiked: false,
  kind: 'EDITED',
  likeCount: 3,
  mimeType: 'image/webp',
  originalUrl: 'http://localhost:3000/public/holiday.edited.webp',
  projectId: 'project-1',
  projectName: '测试图库',
  sizeBytes: 2048,
  status: 'UPLOADED',
  updatedAt: '2026-08-17T08:00:00.000Z',
  width: 1200,
};

function renderGrid(kind: MaterialPhotoKind) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MaterialPhotoGrid kind={kind} projectId="project-1" />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('MaterialPhotoGrid', () => {
  beforeEach(() => {
    apiMocks.getMaterialPhotoComments.mockReset();
    apiMocks.getMaterialPhotoComments.mockResolvedValue([]);
    apiMocks.getMaterialProjectPhotosPage.mockReset();
    apiMocks.setMaterialPhotoFavorite.mockReset();
    apiMocks.setMaterialPhotoLike.mockReset();
    apiMocks.setMaterialPhotoFavorite.mockResolvedValue({
      isFavorited: true,
      photoId: editedPhoto.id,
    });
    apiMocks.setMaterialPhotoLike.mockResolvedValue({
      isLiked: true,
      likeCount: 4,
      photoId: editedPhoto.id,
    });
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect() {}

        observe() {}
      },
    );
  });

  it('requests and renders the edited photo kind', async () => {
    apiMocks.getMaterialProjectPhotosPage.mockResolvedValue({
      items: [editedPhoto],
      nextCursor: null,
    });

    renderGrid('EDITED');

    expect(
      await screen.findByRole('button', { name: '查看 holiday.edited.webp 详情' }),
    ).toBeInTheDocument();
    expect(apiMocks.getMaterialProjectPhotosPage).toHaveBeenCalledWith('project-1', null, 'EDITED');
  });

  it('shows the original-photo empty state', async () => {
    apiMocks.getMaterialProjectPhotosPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderGrid('ORIGINAL');

    expect(await screen.findByText('暂无原图')).toBeInTheDocument();
  });

  it('keeps like and favorite as separate actions', async () => {
    apiMocks.getMaterialProjectPhotosPage.mockResolvedValue({
      items: [editedPhoto],
      nextCursor: null,
    });

    renderGrid('EDITED');

    fireEvent.click(await screen.findByRole('button', { name: '点赞 holiday.edited.webp' }));
    await waitFor(() =>
      expect(apiMocks.setMaterialPhotoLike).toHaveBeenCalledWith('photo-edited', true),
    );
    expect(apiMocks.setMaterialPhotoFavorite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '收藏 holiday.edited.webp' }));
    await waitFor(() =>
      expect(apiMocks.setMaterialPhotoFavorite).toHaveBeenCalledWith('photo-edited', true),
    );
  });
});
