import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ProjectPhoto, ProjectPhotoKind } from '../../../src/api/photos';
import { PhotoGrid } from '../../../src/components/photos/PhotoGrid';

const apiMocks = vi.hoisted(() => ({
  getPhotoThumbnail: vi.fn(),
  getProjectPhotosPage: vi.fn(),
}));

let intersectionCallback: IntersectionObserverCallback | undefined;

vi.mock('../../../src/api/photos', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/photos')>();

  return {
    ...original,
    getPhotoThumbnail: apiMocks.getPhotoThumbnail,
    getProjectPhotosPage: apiMocks.getProjectPhotosPage,
  };
});

const photo: ProjectPhoto = {
  createdAt: '2026-07-27T08:00:00.000Z',
  fileName: 'holiday.jpg',
  favoriteCount: 2,
  height: null,
  id: 'photo-1',
  kind: 'ORIGINAL',
  likeCount: 5,
  mimeType: 'image/jpeg',
  originalUrl: 'http://localhost:3000/public/projects/project-1/photos/photo-1--holiday.jpg',
  projectId: 'project-1',
  sizeBytes: 2048,
  status: 'UPLOADED',
  thumbnailUrl:
    'http://localhost:3000/public/projects/project-1/photos/photo-1--holiday.thumbnail.webp',
  updatedAt: '2026-07-27T08:00:00.000Z',
  width: null,
};

function renderGrid(kind: ProjectPhotoKind = 'ORIGINAL') {
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
        <MemoryRouter>
          <PhotoGrid kind={kind} projectId="project-1" />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('PhotoGrid', () => {
  beforeEach(() => {
    apiMocks.getPhotoThumbnail.mockReset();
    apiMocks.getPhotoThumbnail.mockResolvedValue(new Blob(['thumbnail'], { type: 'image/webp' }));
    apiMocks.getProjectPhotosPage.mockReset();
    intersectionCallback = undefined;
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:thumbnail');
        static revokeObjectURL = vi.fn();
      },
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback;
        }

        disconnect() {}

        observe() {}
      },
    );
  });

  it('shows an empty state when the project has no photos', async () => {
    apiMocks.getProjectPhotosPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderGrid();

    expect(await screen.findByText('暂无原图')).toBeInTheDocument();
    expect(apiMocks.getProjectPhotosPage).toHaveBeenCalledWith('project-1', null, 'ORIGINAL');
  });

  it('loads an authenticated thumbnail blob and renders its object URL', async () => {
    apiMocks.getProjectPhotosPage.mockResolvedValue({
      items: [photo],
      nextCursor: null,
    });

    renderGrid();

    const image = await screen.findByAltText('holiday.jpg');
    expect(apiMocks.getPhotoThumbnail).toHaveBeenCalledWith('project-1', 'photo-1');
    expect(image).toHaveAttribute('src', 'blob:thumbnail');
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByLabelText('5 人点赞，2 人收藏')).toBeInTheDocument();
  });

  it('requests and renders the edited photo kind', async () => {
    const editedPhoto: ProjectPhoto = {
      ...photo,
      fileName: 'holiday.edited.webp',
      id: 'photo-edited',
      kind: 'EDITED',
    };
    apiMocks.getProjectPhotosPage.mockResolvedValue({
      items: [editedPhoto],
      nextCursor: null,
    });

    renderGrid('EDITED');

    expect(
      await screen.findByRole('button', { name: '查看 holiday.edited.webp 详情' }),
    ).toBeInTheDocument();
    expect(apiMocks.getProjectPhotosPage).toHaveBeenCalledWith('project-1', null, 'EDITED');
  });

  it('opens and closes the selected photo details', async () => {
    apiMocks.getProjectPhotosPage.mockResolvedValue({
      items: [
        {
          ...photo,
          height: 800,
          width: 1200,
        },
      ],
      nextCursor: null,
    });
    renderGrid();

    fireEvent.click(await screen.findByRole('button', { name: '查看 holiday.jpg 详情' }));

    expect(await screen.findByRole('dialog', { name: '照片详情' })).toBeInTheDocument();
    expect(screen.getByText('1200 × 800')).toBeInTheDocument();
    expect(screen.getByText('文件名')).toBeInTheDocument();
    expect(screen.getByText('上传时间')).toBeInTheDocument();
    expect(screen.getAllByLabelText('5 人点赞，2 人收藏')).toHaveLength(2);
    expect(
      screen
        .getAllByAltText('holiday.jpg')
        .find((image) => image.getAttribute('src') === photo.originalUrl),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '关闭照片详情' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '照片详情' })).not.toBeInTheDocument();
    });
  });

  it('loads and appends the next page when the sentinel enters the viewport', async () => {
    const secondPhoto: ProjectPhoto = {
      ...photo,
      fileName: 'second.jpg',
      id: 'photo-2',
      originalUrl: 'http://localhost:3000/public/projects/project-1/photos/photo-2--second.jpg',
      thumbnailUrl:
        'http://localhost:3000/public/projects/project-1/photos/photo-2--second.thumbnail.webp',
    };
    apiMocks.getProjectPhotosPage
      .mockResolvedValueOnce({
        items: [photo],
        nextCursor: 'photo-1',
      })
      .mockResolvedValueOnce({
        items: [secondPhoto],
        nextCursor: null,
      });

    renderGrid();

    await screen.findByRole('button', { name: '查看 holiday.jpg 详情' });
    await waitFor(() => {
      expect(intersectionCallback).toBeTypeOf('function');
    });
    act(() => {
      intersectionCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByRole('button', { name: '查看 second.jpg 详情' })).toBeInTheDocument();
    expect(apiMocks.getProjectPhotosPage).toHaveBeenNthCalledWith(
      2,
      'project-1',
      'photo-1',
      'ORIGINAL',
    );
    expect(screen.queryByLabelText('继续加载照片')).not.toBeInTheDocument();
  });
});
