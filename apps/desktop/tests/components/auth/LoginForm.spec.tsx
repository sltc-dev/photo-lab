import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../../../src/components/auth/LoginForm';

describe('LoginForm', () => {
  it('renders login fields and submit button', () => {
    render(
      <MantineProvider>
        <LoginForm onSubmit={vi.fn()} />
      </MantineProvider>,
    );

    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument();
  });

  it('submits normalized form values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MantineProvider>
        <LoginForm onSubmit={onSubmit} />
      </MantineProvider>,
    );

    await user.type(screen.getByLabelText('邮箱'), ' user@example.com ');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      email: 'user@example.com',
      password: 'password123',
    });
  });
});
