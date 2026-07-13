import { Anchor, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/http';
import type { RegisterDto } from '../api/types';
import { AuthShell } from '../components/auth/AuthShell';
import { RegisterForm } from '../components/auth/RegisterForm';
import type { RegisterFormValues } from '../schemas/auth.schema';
import { useAuthStore } from '../stores/auth.store';

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      // 显式组装 API DTO，避免把表单库的内部字段带进 IPC。
      const input: RegisterDto = {
        email: values.email,
        password: values.password,
        username: values.username,
      };

      return window.auth.register(input);
    },
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '注册失败',
      });
    },
    onSuccess: (session) => {
      // 注册成功会直接得到登录会话，因此无需再跳转到登录页。
      setSession({
        accessToken: session.accessToken,
        user: session.user,
      });
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthShell subtitle="Photo Lab 工作台" title="创建账号">
      <RegisterForm
        isSubmitting={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
      />
      <Group justify="center">
        <Text c="dimmed" size="sm">
          已有账号？
        </Text>
        <Anchor component={Link} size="sm" to="/login">
          登录
        </Anchor>
      </Group>
    </AuthShell>
  );
}
