// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ApiRequestError,
  AUTH_API_REQUEST_TIMEOUT_MS,
  isInvalidRefreshTokenError,
  postJson,
} from '../../electron/auth/auth-api-client';

describe('auth API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('applies a ten-second timeout to main-process requests', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await postJson('/health', {}, z.object({ ok: z.boolean() }));

    expect(timeoutSpy).toHaveBeenCalledWith(AUTH_API_REQUEST_TIMEOUT_MS);
    expect(AUTH_API_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves an HTTP status even when an error response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('not-json', { status: 401 })),
    );

    const error = await postJson('/auth/refresh', {}, z.object({})).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401 });
    expect(isInvalidRefreshTokenError(error)).toBe(true);
  });

  it.each([
    [400, true],
    [401, true],
    [429, false],
    [500, false],
  ])('classifies HTTP %i as invalid refresh token: %s', (status, expected) => {
    expect(isInvalidRefreshTokenError(new ApiRequestError('Request failed.', status))).toBe(
      expected,
    );
  });
});
