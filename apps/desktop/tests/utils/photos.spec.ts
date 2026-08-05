// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApiClient } from '../../src/api/http';
import { getPhotoEditorSource } from '../../src/api/photos';

describe('photos', () => {
  configureApiClient();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the original when no edit state has been saved', async () => {
    const original = new Blob(['original'], { type: 'image/jpeg' });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ editState: null }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(original, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPhotoEditorSource('project-1', 'photo-1');

    expect(result.editState).toBeNull();
    expect(await result.blob.text()).toBe('original');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loads the original and restores object state for an editable draft', async () => {
    const original = new Blob(['original'], { type: 'image/jpeg' });
    const editState = {
      annotations: { text: { text: '标题' } },
      imgSrc: 'blob:http://localhost:5173/expired',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ editState }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(original, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPhotoEditorSource('project-1', 'photo-1');

    expect(result).toMatchObject({
      editState: { annotations: editState.annotations },
    });
    expect(result.editState).not.toHaveProperty('imgSrc');
    expect(await result.blob.text()).toBe('original');
    expect((fetchMock.mock.calls[1]![0] as Request).url).toContain('/original');
  });
});
