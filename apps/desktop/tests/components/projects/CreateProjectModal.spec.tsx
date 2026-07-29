import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateProjectModal } from '../../../src/components/projects/CreateProjectModal';

describe('CreateProjectModal', () => {
  it('submits normalized project values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MantineProvider>
        <CreateProjectModal isSubmitting={false} onClose={vi.fn()} onSubmit={onSubmit} />
      </MantineProvider>,
    );

    await user.type(screen.getByLabelText(/项目名称/), '  夏季旅行  ');
    await user.type(screen.getByLabelText('项目描述'), '  海边照片  ');
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    expect(onSubmit).toHaveBeenCalledWith(
      {
        description: '海边照片',
        name: '夏季旅行',
      },
      expect.anything(),
    );
  });

  it('shows a validation error for an empty name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MantineProvider>
        <CreateProjectModal isSubmitting={false} onClose={vi.fn()} onSubmit={onSubmit} />
      </MantineProvider>,
    );

    await user.type(screen.getByLabelText(/项目名称/), '   ');
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    expect(await screen.findByText('请输入项目名称')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
