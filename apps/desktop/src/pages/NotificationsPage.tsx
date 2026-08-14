import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Skeleton,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { notifications as toast } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  BellOff,
  ChevronRight,
  CheckCheck,
  Info,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getNotificationDetail,
  getNotifications,
  notificationDetailQueryKey,
  notificationListQueryKey,
  notificationsQueryKey,
  readNotification,
  type AppNotification,
} from '../api/notifications';
import styles from '../styles/pages/NotificationsPage.module.css';

export function NotificationsPage() {
  const { notificationId } = useParams<{ notificationId: string }>();

  return notificationId ? (
    <NotificationDetailPage notificationId={notificationId} />
  ) : (
    <NotificationListPage />
  );
}

function NotificationListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get('filter') === 'unread' ? 'unread' : 'all';
  const allNotificationsQuery = useQuery({
    queryFn: () => getNotifications(),
    queryKey: notificationListQueryKey(),
    refetchInterval: 60_000,
  });
  const unreadNotificationsQuery = useQuery({
    enabled: activeFilter === 'unread',
    queryFn: () => getNotifications(false),
    queryKey: notificationListQueryKey(false),
    refetchInterval: 60_000,
  });
  const notificationItems = allNotificationsQuery.data?.items ?? [];
  const unreadCount =
    allNotificationsQuery.data?.unreadCount ?? unreadNotificationsQuery.data?.unreadCount ?? 0;

  return (
    <Stack className={styles.content} gap="lg">
      <Box className={styles.pageHeading}>
        <Text className={styles.eyebrow}>消息</Text>
        <Title className={styles.pageTitle} id="notifications-page-title" order={2}>
          通知中心
        </Title>
        <Text c="dimmed" mt={6}>
          查看系统消息、版本更新和重要提醒。
        </Text>
      </Box>

      <section aria-labelledby="notifications-page-title" className={styles.listPanel}>
        <Tabs
          className={styles.tabs}
          classNames={{ list: styles.tabsList, tab: styles.tab }}
          onChange={(value) => {
            setSearchParams(value === 'unread' ? { filter: 'unread' } : {}, { replace: true });
          }}
          value={activeFilter}
        >
          <Tabs.List aria-label="通知筛选">
            <Tabs.Tab value="all">
              <Group gap={7}>
                全部
                <Badge color="blue" size="xs" variant="light">
                  {notificationItems.length}
                </Badge>
              </Group>
            </Tabs.Tab>
            <Tabs.Tab value="unread">
              <Group gap={7}>
                未读
                <Badge color="red" size="xs" variant="light">
                  {unreadCount}
                </Badge>
              </Group>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all">
            <NotificationListContent
              isError={allNotificationsQuery.isError}
              isLoading={allNotificationsQuery.isLoading}
              notifications={notificationItems}
              onRetry={() => void allNotificationsQuery.refetch()}
            />
          </Tabs.Panel>
          <Tabs.Panel value="unread">
            <NotificationListContent
              isError={unreadNotificationsQuery.isError}
              isLoading={unreadNotificationsQuery.isLoading}
              isUnreadFilter
              notifications={unreadNotificationsQuery.data?.items ?? []}
              onRetry={() => void unreadNotificationsQuery.refetch()}
            />
          </Tabs.Panel>
        </Tabs>
      </section>
    </Stack>
  );
}

function NotificationListContent({
  isError,
  isLoading,
  isUnreadFilter = false,
  notifications,
  onRetry,
}: {
  isError: boolean;
  isLoading: boolean;
  isUnreadFilter?: boolean;
  notifications: AppNotification[];
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <Stack aria-label="正在加载通知" className={styles.skeletonList} gap="sm">
        {[0, 1, 2].map((item) => (
          <Skeleton height={116} key={item} radius="md" />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert
        className={styles.errorAlert}
        color="red"
        icon={<AlertCircle aria-hidden size={20} />}
        title="通知加载失败"
      >
        <Group justify="space-between" wrap="wrap">
          <Text size="sm">暂时无法获取通知，请检查服务连接后重试。</Text>
          <Button
            color="red"
            leftSection={<RefreshCw aria-hidden size={16} />}
            onClick={onRetry}
            size="xs"
            variant="light"
          >
            重新加载
          </Button>
        </Group>
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return (
      <Center className={styles.emptyState}>
        <Stack align="center" gap="sm">
          <ThemeIcon color="gray" radius="xl" size={52} variant="light">
            {isUnreadFilter ? (
              <CheckCheck aria-hidden size={23} />
            ) : (
              <BellOff aria-hidden size={23} />
            )}
          </ThemeIcon>
          <Title order={3}>{isUnreadFilter ? '没有未读通知' : '暂无通知'}</Title>
          <Text c="dimmed">
            {isUnreadFilter ? '所有通知都已阅读。' : '系统消息和版本更新会显示在这里。'}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack className={styles.notificationList} gap={0}>
      {notifications.map((notification) => (
        <UnstyledButton
          aria-label={`查看通知：${notification.title}`}
          className={styles.notificationItem}
          component={Link}
          data-unread={!notification.isRead || undefined}
          key={notification.id}
          to={`/notifications/${notification.id}`}
        >
          <Group align="center" className={styles.itemLayout} gap="md" wrap="nowrap">
            <span
              aria-hidden
              className={styles.itemTypeIcon}
              data-level={notification.level}
              data-upgrade={notification.type === 'VERSION_UPGRADE' || undefined}
            >
              {notification.type === 'VERSION_UPGRADE' ? <Rocket size={18} /> : <Info size={18} />}
              <span className={styles.unreadDot} />
            </span>
            <Box className={styles.itemContent}>
              <Group align="flex-start" gap="md" justify="space-between" wrap="nowrap">
                <Group className={styles.titleGroup} gap="xs" wrap="wrap">
                  <Text
                    className={styles.itemTitle}
                    fw={notification.isRead ? 600 : 750}
                    lineClamp={1}
                  >
                    {notification.title}
                  </Text>
                  <NotificationTypeBadge notification={notification} />
                </Group>
                <Text c="dimmed" className={styles.itemDate} size="xs">
                  {formatRelativeDate(notification.publishedAt)}
                </Text>
              </Group>
              <Text c="dimmed" className={styles.itemSummary} lineClamp={2} mt={6}>
                {notification.summary}
              </Text>
            </Box>
            <span aria-hidden className={styles.openIcon}>
              <ChevronRight size={19} />
            </span>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

function NotificationDetailPage({ notificationId }: { notificationId: string }) {
  const queryClient = useQueryClient();
  const markedNotificationId = useRef<string | null>(null);
  const detailQueryKey = notificationDetailQueryKey(notificationId);
  const detailQuery = useQuery({
    queryFn: () => getNotificationDetail(notificationId),
    queryKey: detailQueryKey,
  });
  const readMutation = useMutation({
    mutationFn: () => readNotification(notificationId),
    onError: () => {
      toast.show({ color: 'red', message: '请稍后重试', title: '通知状态更新失败' });
    },
    onSuccess: () => {
      queryClient.setQueryData(detailQueryKey, (current: typeof detailQuery.data) =>
        current ? { ...current, isRead: true } : current,
      );
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  useEffect(() => {
    if (
      detailQuery.data &&
      !detailQuery.data.isRead &&
      markedNotificationId.current !== notificationId
    ) {
      markedNotificationId.current = notificationId;
      readMutation.mutate();
    }
  }, [detailQuery.data, notificationId, readMutation]);

  return (
    <Stack className={styles.detailContent} gap="lg">
      <UnstyledButton
        aria-label="返回通知列表"
        className={styles.backButton}
        component={Link}
        to="/notifications"
      >
        <ArrowLeft aria-hidden size={17} />
        返回通知列表
      </UnstyledButton>

      {detailQuery.isLoading ? (
        <Stack aria-label="正在加载通知详情" gap="md">
          <Skeleton height={28} radius="sm" width={110} />
          <Skeleton height={42} radius="sm" width="72%" />
          <Skeleton height={18} radius="sm" width={190} />
          <Skeleton height={220} mt="lg" radius="md" />
        </Stack>
      ) : detailQuery.isError || !detailQuery.data ? (
        <Alert color="red" icon={<AlertCircle aria-hidden size={18} />} title="通知详情加载失败">
          <Stack align="flex-start" gap="sm">
            <Text size="sm">这条通知可能已经失效，请返回列表或重新加载。</Text>
            <Button
              color="red"
              leftSection={<RefreshCw aria-hidden size={16} />}
              onClick={() => void detailQuery.refetch()}
              size="xs"
              variant="light"
            >
              重新加载
            </Button>
          </Stack>
        </Alert>
      ) : (
        <article className={styles.detailArticle}>
          <NotificationTypeBadge notification={detailQuery.data} />
          <Title className={styles.detailTitle} mt="md" order={2}>
            {detailQuery.data.title}
          </Title>
          <Text c="dimmed" mt={8} size="sm">
            发布于 {formatFullDate(detailQuery.data.publishedAt)}
          </Text>

          <Divider my="xl" />
          <Text className={styles.articleSummary}>{detailQuery.data.summary}</Text>
          <Text className={styles.articleBody} mt="lg">
            {detailQuery.data.content}
          </Text>
        </article>
      )}
    </Stack>
  );
}

function NotificationTypeBadge({ notification }: { notification: AppNotification }) {
  const isUpgrade = notification.type === 'VERSION_UPGRADE';
  const isCritical = notification.level === 'CRITICAL';
  const color = isCritical
    ? 'red'
    : isUpgrade
      ? 'blue'
      : notification.level === 'WARNING'
        ? 'orange'
        : 'violet';

  return (
    <Badge color={color} size="sm" variant="light">
      {isUpgrade ? '版本更新' : '系统通知'}
    </Badge>
  );
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime())) return '未知时间';
  if (difference < 60_000) return '刚刚';
  if (difference < 60 * 60_000) return `${Math.floor(difference / 60_000)} 分钟前`;
  if (difference < 24 * 60 * 60_000) {
    return `${Math.floor(difference / (60 * 60_000))} 小时前`;
  }
  return new Intl.DateTimeFormat('zh-CN', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatFullDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}
