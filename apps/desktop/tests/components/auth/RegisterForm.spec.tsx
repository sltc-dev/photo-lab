import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '../../../src/components/auth/RegisterForm';

describe('RegisterForm', () => {
  it('renders register fields and submit button', () => {
    render(
      <MantineProvider>
        <RegisterForm onSubmit={vi.fn()} />
      </MantineProvider>,
    );

    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /注册/ })).toBeInTheDocument();
  });

  it('rejects a whitespace-only username', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MantineProvider>
        <RegisterForm onSubmit={onSubmit} />
      </MantineProvider>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('用户名'), '  ');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: /注册/ }));

    expect(await screen.findByText('用户名至少 2 位')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
