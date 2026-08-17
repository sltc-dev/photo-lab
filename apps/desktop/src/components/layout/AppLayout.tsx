import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { Image, Images, LibraryBig, LogOut, Star, User, type LucideIcon } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/http';
import { terminateSession } from '../../api/session';
import { useAuthStore } from '../../stores/auth.store';
import styles from '../../styles/components/layout/AppLayout.module.css';

export function AppLayout() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const location = useLocation();
  const [isNavigationOpen, { close: closeNavigation, toggle: toggleNavigation }] =
    useDisclosure(false);
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
    <AppShell
      header={{ height: 64 }}
      navbar={{
        breakpoint: 'sm',
        collapsed: { mobile: !isNavigationOpen },
        width: 244,
      }}
      padding={{ base: 'md', sm: 'lg' }}
    >
      <AppShell.Header className={styles.header}>
        <Group className={styles.headerInner} justify="space-between">
          <Group className={styles.headerGroup} gap="sm">
            <Burger
              aria-label={isNavigationOpen ? '关闭主菜单' : '打开主菜单'}
              hiddenFrom="sm"
              onClick={toggleNavigation}
              opened={isNavigationOpen}
              size="sm"
            />
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
              <span className={styles.logoutLabel}>退出</span>
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar aria-label="主菜单" className={styles.navbar} p="md">
        <Text className={styles.navLabel}>工作区</Text>
        <Stack gap={6}>
          {navigationItems.map((item) => (
            <NavLink
              active={item.isActive(location.pathname)}
              className={styles.navLink}
              component={Link}
              key={item.to}
              label={item.label}
              leftSection={<item.icon aria-hidden size={18} />}
              onClick={closeNavigation}
              to={item.to}
            />
          ))}
        </Stack>

        <Box className={styles.navHint}>
          <Images aria-hidden size={17} />
          <Text size="xs">按项目整理照片，保持素材清晰有序。</Text>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main className={styles.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

type NavigationItem = {
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
  label: string;
  to: string;
};

const navigationItems: NavigationItem[] = [
  {
    icon: Image,
    isActive: (pathname) => pathname === '/' || pathname.startsWith('/projects/'),
    label: '图库',
    to: '/',
  },
  {
    icon: LibraryBig,
    isActive: (pathname) => pathname.startsWith('/materials'),
    label: '素材库',
    to: '/materials',
  },
  {
    icon: Star,
    isActive: (pathname) => pathname.startsWith('/favorites'),
    label: '我的收藏',
    to: '/favorites',
  },
  {
    icon: User,
    isActive: (pathname) => pathname === '/profile',
    label: '个人资料',
    to: '/profile',
  },
];
