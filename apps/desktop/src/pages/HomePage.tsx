import {
  AppShell,
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { Image, LogOut, User } from 'lucide-react';
import { getApiErrorMessage } from '../api/http';
import { terminateSession } from '../api/session';
import { useAuthStore } from '../stores/auth.store';
import styles from '../styles/pages/HomePage.module.css';

export function HomePage() {
  const currentUser = useAuthStore((state) => state.currentUser);

  const logoutMutation = useMutation({
    mutationFn: terminateSession,
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '本机登录凭据清理失败',
      });
    },
    onSuccess: () => {
      notifications.show({
        color: 'green',
        message: '已退出登录',
        title: '完成',
      });
    },
  });

  return (
    <AppShell header={{ height: 64 }} navbar={{ breakpoint: 'sm', width: 236 }} padding="lg">
      <AppShell.Header className={styles.header}>
        <Group className={styles.headerInner} justify="space-between">
          <Group className={styles.headerGroup} gap="sm">
            <Box className={styles.logoMark}>
              <Image aria-hidden size={19} />
            </Box>
            <Title className={styles.appTitle} order={1}>
              Photo Lab
            </Title>
          </Group>
          <Group className={styles.headerGroup} gap="sm">
            <Avatar className={styles.avatar} radius="xl" size="sm">
              {currentUser?.username.slice(0, 1).toUpperCase()}
            </Avatar>
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {currentUser?.username}
              </Text>
              <Text c="dimmed" size="xs">
                {currentUser?.email}
              </Text>
            </Stack>
            <Button
              className={styles.logoutButton}
              leftSection={<LogOut size={16} />}
              loading={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              radius="sm"
              variant="subtle"
            >
              退出
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavLink active className={styles.navLink} label="图库" leftSection={<Image size={18} />} />
        <NavLink className={styles.navLink} label="个人" leftSection={<User size={18} />} />
      </AppShell.Navbar>

      <AppShell.Main className={styles.main}>
        <Stack gap="lg">
          <section className={styles.workspaceHeader}>
            <Group align="flex-start" justify="space-between">
              <Box>
                <Text className={styles.eyebrow}>Workspace</Text>
                <Title className={styles.pageTitle} order={2}>
                  图库工作台
                </Title>
                <Text className={styles.pageDescription}>
                  当前暂无项目，基础注册与登录流程已就绪。
                </Text>
              </Box>
              <Badge className={styles.statusBadge} variant="light">
                Foundation
              </Badge>
            </Group>
          </section>

          <section className={styles.emptyPanel}>
            <div className={styles.emptyIcon}>
              <Image aria-hidden size={24} />
            </div>
            <Title order={3}>暂无项目</Title>
            <Text>后续图片项目接入后，会在这里展示最近的图库与处理状态。</Text>
          </section>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
