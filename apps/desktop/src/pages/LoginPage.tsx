import { Anchor, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/http';
import { AuthShell } from '../components/auth/AuthShell';
import { LoginForm } from '../components/auth/LoginForm';
import type { LoginFormValues } from '../schemas/auth.schema';
import { useAuthStore } from '../stores/auth.store';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      // 通过 preload 调主进程，登录 HTTP 请求不从 React 直接发出。
      return window.auth.login(values);
    },
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '登录失败',
      });
    },
    onSuccess: (session) => {
      // 主进程已经保存 Refresh Token；React 只保存 Access Token 和公开用户。
      setSession({
        accessToken: session.accessToken,
        user: session.user,
      });
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthShell subtitle="Photo Lab 工作台" title="欢迎回来">
      <LoginForm isSubmitting={mutation.isPending} onSubmit={(values) => mutation.mutate(values)} />
      <Group justify="center">
        <Text c="dimmed" size="sm">
          没有账号？
        </Text>
        <Anchor component={Link} size="sm" to="/register">
          注册
        </Anchor>
      </Group>
    </AuthShell>
  );
}
