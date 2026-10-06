// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { queryClient } from '../../src/api/query-client';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

describe('query error notifications', () => {
  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('notifies opted-in queries after failure and avoids duplicate page notifications', async () => {
    const error = {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后重试。' },
    };
    for (const notifyError of [true, false]) {
      await expect(
        queryClient.fetchQuery({
          queryKey: ['test-error', notifyError],
          queryFn: () => Promise.reject(error),
          retry: false,
          meta: { notifyError },
        }),
      ).rejects.toEqual(error);
    }
    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'api-query-error', message: '请求过于频繁，请稍后重试。' }),
    );
  });
});
