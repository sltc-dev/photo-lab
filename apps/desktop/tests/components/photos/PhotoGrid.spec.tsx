import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectPhoto } from '../../../src/api/photos';
import { PhotoGrid } from '../../../src/components/photos/PhotoGrid';

const apiMocks = vi.hoisted(() => ({
  getPhotoOriginal: vi.fn(),
  getPhotoThumbnail: vi.fn(),
  getProjectPhotos: vi.fn(),
}));

vi.mock('../../../src/api/photos', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/photos')>();

  return {
    ...original,
    getPhotoOriginal: apiMocks.getPhotoOriginal,
    getPhotoThumbnail: apiMocks.getPhotoThumbnail,
    getProjectPhotos: apiMocks.getProjectPhotos,
  };
});

const photo: ProjectPhoto = {
  createdAt: '2026-07-27T08:00:00.000Z',
  fileName: 'holiday.jpg',
  height: null,
  id: 'photo-1',
  mimeType: 'image/jpeg',
  projectId: 'project-1',
  sizeBytes: 2048,
  status: 'UPLOADED',
  updatedAt: '2026-07-27T08:00:00.000Z',
  width: null,
};

function renderGrid() {
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
        <PhotoGrid projectId="project-1" />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('PhotoGrid', () => {
  beforeEach(() => {
    apiMocks.getPhotoOriginal.mockReset();
    apiMocks.getPhotoThumbnail.mockReset();
    apiMocks.getProjectPhotos.mockReset();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:photo-1'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows an empty state when the project has no photos', async () => {
    apiMocks.getProjectPhotos.mockResolvedValue([]);

    renderGrid();

    expect(await screen.findByText('这个项目还没有照片')).toBeInTheDocument();
    expect(apiMocks.getProjectPhotos).toHaveBeenCalledWith('project-1');
    expect(apiMocks.getPhotoOriginal).not.toHaveBeenCalled();
    expect(apiMocks.getPhotoThumbnail).not.toHaveBeenCalled();
  });

  it('loads authenticated thumbnail blobs into the grid without requesting originals', async () => {
    apiMocks.getProjectPhotos.mockResolvedValue([photo]);
    apiMocks.getPhotoThumbnail.mockResolvedValue(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], {
        type: 'image/webp',
      }),
    );

    renderGrid();

    const image = await screen.findByAltText('holiday.jpg');
    expect(image).toHaveAttribute('src', 'blob:photo-1');
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(apiMocks.getPhotoThumbnail).toHaveBeenCalledWith('project-1', 'photo-1');
    expect(apiMocks.getPhotoOriginal).not.toHaveBeenCalled();
  });

  it('opens and closes the selected photo details', async () => {
    apiMocks.getProjectPhotos.mockResolvedValue([
      {
        ...photo,
        height: 800,
        width: 1200,
      },
    ]);
    apiMocks.getPhotoThumbnail.mockResolvedValue(
      new Blob([new Uint8Array([0x01, 0x02])], {
        type: 'image/webp',
      }),
    );
    apiMocks.getPhotoOriginal.mockResolvedValue(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], {
        type: 'image/jpeg',
      }),
    );

    renderGrid();

    fireEvent.click(await screen.findByRole('button', { name: '查看 holiday.jpg 详情' }));

    expect(await screen.findByRole('dialog', { name: '照片详情' })).toBeInTheDocument();
    expect(screen.getByText('1200 × 800')).toBeInTheDocument();
    expect(screen.getByText('文件名')).toBeInTheDocument();
    expect(screen.getByText('上传时间')).toBeInTheDocument();
    expect(apiMocks.getPhotoOriginal).toHaveBeenCalledWith('project-1', 'photo-1');

    fireEvent.click(screen.getByRole('button', { name: '关闭照片详情' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '照片详情' })).not.toBeInTheDocument();
    });
  });
});
