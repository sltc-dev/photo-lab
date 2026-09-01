import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactAdminModal } from '../../../src/components/feedback/ContactAdminModal';

const apiMocks = vi.hoisted(() => ({
  sendFeedback: vi.fn(),
}));

vi.mock('../../../src/api/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/feedback')>()),
  sendFeedback: apiMocks.sendFeedback,
}));

describe('ContactAdminModal', () => {
  beforeEach(() => {
    apiMocks.sendFeedback.mockResolvedValue({
      category: 'BUG',
      createdAt: '2026-08-31T00:00:00.000Z',
      referenceId: 'PL-A1B2C3D4E5F6',
    });
  });

  function renderModal(onClose = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <ContactAdminModal onClose={onClose} opened />
        </QueryClientProvider>
      </MantineProvider>,
    );
    return onClose;
  }

  it('stores the feedback and closes after submission', async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.change(screen.getByLabelText(/留言内容/), {
      target: { value: '上传照片时出现错误。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送留言' }));

    await waitFor(() => expect(apiMocks.sendFeedback).toHaveBeenCalledOnce());
    expect(apiMocks.sendFeedback).toHaveBeenCalledWith({
      category: 'BUG',
      message: '上传照片时出现错误。',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not allow an empty message to be sent', () => {
    renderModal();

    expect(screen.getByRole('button', { name: '发送留言' })).toBeDisabled();
  });
});
