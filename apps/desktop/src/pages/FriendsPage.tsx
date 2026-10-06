import { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Chip,
  Switch,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, RefreshCw, UserPlus, Users, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  friendsQueryKey,
  locationsQueryKey,
  performFriendAction,
  readFriendRequests,
  readFriends,
  readNearbyUsers,
  saveLocationSettings,
  type FriendAction,
} from '../api/friends';
import { getApiErrorMessage } from '../api/http';
import { notificationsQueryKey } from '../api/notifications';
import { useLocationStatus } from '../components/friends/LocationProvider';
import { CurrentLocationAddress } from '../components/friends/CurrentLocationAddress';
import { useAuthStore } from '../stores/auth.store';
import styles from '../styles/pages/FriendsPage.module.css';

const requestStatusLabels = {
  PENDING: { color: 'yellow', label: '\u5f85\u5904\u7406' },
  ACCEPTED: { color: 'green', label: '\u5df2\u901a\u8fc7' },
  REJECTED: { color: 'red', label: '\u5df2\u62d2\u7edd' },
  CANCELLED: { color: 'gray', label: '\u5df2\u64a4\u56de' },
  EXPIRED: { color: 'gray', label: '\u5df2\u8fc7\u671f' },
} as const;

export function FriendsPage() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<string | null>(
    requestedTab && ['nearby', 'incoming', 'outgoing', 'friends'].includes(requestedTab)
      ? requestedTab
      : 'nearby',
  );
  const [requestFilters, setRequestFilters] = useState<
    Record<'incoming' | 'outgoing', keyof typeof requestStatusLabels | 'ALL'>
  >({ incoming: 'ALL', outgoing: 'ALL' });
  const [refreshingNearby, setRefreshingNearby] = useState(false);
  const nearbyRefreshPending = useRef(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.currentUser?.id);
  const queryClient = useQueryClient();
  const status = useLocationStatus();
  const radiusMeters = status.config?.nearby.radiusMeters;
  const maxAccuracyMeters = status.config?.nearby.maxAccuracyMeters;
  const refreshSeconds = status.config ? status.config.location.refreshIntervalMs / 1000 : null;
  const canSearch = Boolean(
    status.settings?.locationEnabled &&
    status.uploaded &&
    status.location &&
    maxAccuracyMeters !== undefined &&
    status.location.accuracyMeters <= maxAccuracyMeters &&
    status.config &&
    new Date(status.location.capturedAt).getTime() + status.config.location.ttlMs > Date.now(),
  );
  const nearby = useQuery({
    queryKey: [...locationsQueryKey, 'nearby', userId],
    queryFn: ({ signal }) => readNearbyUsers(signal),
    enabled: tab === 'nearby' && canSearch,
    refetchInterval: status.config?.list.refetchIntervalMs ?? false,
    meta: { notifyError: true },
    retry: false,
  });
  const refreshNearby = async () => {
    if (!canSearch || nearbyRefreshPending.current) return;
    nearbyRefreshPending.current = true;
    setRefreshingNearby(true);
    try {
      await nearby.refetch({ cancelRefetch: false });
    } finally {
      nearbyRefreshPending.current = false;
      setRefreshingNearby(false);
    }
  };
  const incoming = useQuery({
    queryKey: [...friendsQueryKey, 'incoming', userId, requestFilters.incoming],
    queryFn: ({ signal }) =>
      readFriendRequests(
        'incoming',
        signal,
        requestFilters.incoming === 'ALL' ? undefined : requestFilters.incoming,
      ),
    enabled: tab === 'incoming',
    refetchInterval: status.config?.list.refetchIntervalMs ?? false,
    meta: { notifyError: true },
  });
  const outgoing = useQuery({
    queryKey: [...friendsQueryKey, 'outgoing', userId, requestFilters.outgoing],
    queryFn: ({ signal }) =>
      readFriendRequests(
        'outgoing',
        signal,
        requestFilters.outgoing === 'ALL' ? undefined : requestFilters.outgoing,
      ),
    enabled: tab === 'outgoing',
    refetchInterval: status.config?.list.refetchIntervalMs ?? false,
    meta: { notifyError: true },
  });
  const friends = useQuery({
    queryKey: [...friendsQueryKey, 'list', userId],
    queryFn: ({ signal }) => readFriends(signal),
    enabled: tab === 'friends',
    refetchInterval: status.config?.list.refetchIntervalMs ?? false,
    meta: { notifyError: true },
  });

  const showError = async (error: unknown) =>
    notifications.show({
      color: 'red',
      title: '操作失败',
      message: await getApiErrorMessage(error),
    });
  const actionMutation = useMutation({
    mutationFn: performFriendAction,
    onSuccess: async () => {
      setRemoveId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: friendsQueryKey }),
        queryClient.invalidateQueries({ queryKey: [...locationsQueryKey, 'nearby'] }),
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
      ]);
    },
    onError: async (error) => {
      await showError(error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: friendsQueryKey }),
        queryClient.invalidateQueries({ queryKey: [...locationsQueryKey, 'nearby'] }),
      ]);
    },
  });
  const settingsMutation = useMutation({
    mutationFn: saveLocationSettings,
    onSuccess: async (settings) => {
      queryClient.setQueryData([...locationsQueryKey, 'settings', userId], settings);
      await queryClient.invalidateQueries({ queryKey: [...locationsQueryKey, 'nearby'] });
      setConsentOpen(false);
    },
    onError: async (error) => {
      await showError(error);
      await queryClient.invalidateQueries({ queryKey: [...locationsQueryKey, 'settings'] });
    },
  });

  const changeSettings = (locationEnabled: boolean, discoverable: boolean) => {
    if (status.settings)
      settingsMutation.mutate({
        locationEnabled,
        discoverable,
      });
  };
  const act = (action: FriendAction) => actionMutation.mutate(action);
  const send = (otherUserId: string) => act({ action: 'send', userId: otherUserId });

  const requests = tab === 'incoming' ? incoming : outgoing;
  const pending = actionMutation.isPending;

  return (
    <Stack className={styles.page} gap="lg">
      <Box className={styles.pageHeading}>
        <Title className={styles.pageTitle} order={2}>
          附近好友
        </Title>
        <Text c="dimmed" mt={6}>
          发现身边的人，管理好友与申请。
        </Text>
      </Box>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List className={styles.tabsList}>
          <Tabs.Tab value="nearby" leftSection={<MapPin size={16} />}>
            附近的人
          </Tabs.Tab>
          <Tabs.Tab value="incoming" leftSection={<UserPlus size={16} />}>
            收到的申请
          </Tabs.Tab>
          <Tabs.Tab value="outgoing" leftSection={<Send size={16} />}>
            发出的申请
          </Tabs.Tab>
          <Tabs.Tab value="friends" leftSection={<Users size={16} />}>
            我的好友
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="nearby" pt="lg">
          <Stack gap="lg">
            <Card className={styles.locationCard} padding="lg">
              <Stack gap="md">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="sm">
                    <Box className={styles.locationIcon}>
                      <MapPin aria-hidden size={20} />
                    </Box>
                    <div>
                      <Title order={3} className={styles.sectionTitle}>
                        我的位置
                      </Title>
                      <Text c="dimmed" size="sm" mt={3}>
                        {status.settings?.locationEnabled
                          ? '定位已开启，仅在窗口可见时更新'
                          : '开启定位后，即可查看附近的人'}
                      </Text>
                    </div>
                  </Group>
                  <Button
                    className={styles.refreshButton}
                    aria-busy={status.collecting}
                    disabled={
                      !status.settings?.locationEnabled || !status.config || status.collecting
                    }
                    leftSection={
                      <RefreshCw
                        aria-hidden
                        size={15}
                        className={status.collecting ? styles.refreshSpinning : undefined}
                      />
                    }
                    onClick={() => void status.refresh()}
                    variant="default"
                    size="sm"
                  >
                    {status.collecting ? '更新中…' : '更新位置'}
                  </Button>
                </Group>
                <Group className={styles.locationControls} gap="xl" wrap="wrap">
                  <Switch
                    checked={status.settings?.locationEnabled ?? false}
                    disabled={!status.settings || settingsMutation.isPending}
                    label="开启定位"
                    onChange={(event) =>
                      event.currentTarget.checked
                        ? setConsentOpen(true)
                        : changeSettings(false, false)
                    }
                  />
                  <Switch
                    checked={status.settings?.discoverable ?? false}
                    disabled={!status.settings?.locationEnabled || settingsMutation.isPending}
                    label="允许附近的人发现我"
                    onChange={(event) => changeSettings(true, event.currentTarget.checked)}
                  />
                </Group>
                {status.location && userId && status.settings?.locationEnabled ? (
                  <CurrentLocationAddress
                    key={userId}
                    location={status.location}
                    uploaded={status.uploaded}
                    userId={userId}
                  />
                ) : null}
                {status.error ? (
                  <Alert color="orange" title="暂时无法获取位置">
                    {status.error}
                  </Alert>
                ) : null}
                {status.settingsError ? (
                  <Alert color="red">
                    定位设置加载失败，请重试。{' '}
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() =>
                        void queryClient.invalidateQueries({ queryKey: locationsQueryKey })
                      }
                    >
                      重试
                    </Button>
                  </Alert>
                ) : null}
              </Stack>
            </Card>
            <Box className={styles.listSection}>
              <Group justify="space-between" className={styles.listHeading}>
                <Title order={3} className={styles.sectionTitle}>
                  附近的人
                </Title>
                <Group gap="md">
                  <Text c="dimmed" size="sm">
                    {radiusMeters !== undefined
                      ? `附近 ${radiusMeters.toLocaleString()} 米`
                      : '正在加载范围…'}
                  </Text>
                  <Button
                    className={styles.refreshButton}
                    aria-busy={refreshingNearby}
                    disabled={!canSearch || refreshingNearby}
                    leftSection={
                      <RefreshCw
                        aria-hidden
                        size={15}
                        className={refreshingNearby ? styles.refreshSpinning : undefined}
                      />
                    }
                    onClick={() => void refreshNearby()}
                    variant="default"
                    size="sm"
                  >
                    {refreshingNearby ? '刷新中…' : '刷新列表'}
                  </Button>
                </Group>
              </Group>

              {!canSearch &&
              !(status.collecting && status.settings?.locationEnabled && nearby.data) ? (
                <EmptyState
                  action={
                    !status.settings?.locationEnabled ? (
                      <Button
                        className={styles.primaryButton}
                        disabled={!status.settings || settingsMutation.isPending}
                        onClick={() => setConsentOpen(true)}
                        leftSection={<MapPin size={16} />}
                      >
                        开启定位
                      </Button>
                    ) : undefined
                  }
                  text={
                    status.location &&
                    maxAccuracyMeters !== undefined &&
                    status.location.accuracyMeters > maxAccuracyMeters
                      ? `当前定位精度不足，请更新位置后重试（需要在 ${maxAccuracyMeters} 米以内）。`
                      : status.settings?.locationEnabled
                        ? '正在等待有效位置，请稍后或点击更新位置。'
                        : '开启定位，发现附近的人。'
                  }
                />
              ) : nearby.isPending ? (
                <Loading />
              ) : nearby.isError && !nearby.data ? (
                <QueryError onRetry={() => void nearby.refetch()} />
              ) : (
                <Stack gap="sm">
                  {nearby.data?.items.length ? (
                    nearby.data.items.map((person) => (
                      <PersonRow
                        key={person.userId}
                        username={person.username}
                        detail={`距离约 ${person.approximateDistanceMeters} 米`}
                      >
                        <Group gap="xs">
                          {person.relationshipState === 'NONE' ? (
                            <Button
                              disabled={pending || !canSearch}
                              onClick={() => send(person.userId)}
                              size="sm"
                            >
                              添加好友
                            </Button>
                          ) : person.relationshipState === 'INCOMING_PENDING' &&
                            person.requestId ? (
                            <Button
                              disabled={pending}
                              onClick={() =>
                                act({ action: 'accept', requestId: person.requestId! })
                              }
                              size="sm"
                            >
                              同意申请
                            </Button>
                          ) : (
                            <Badge color={person.relationshipState === 'FRIEND' ? 'teal' : 'gray'}>
                              {person.relationshipState === 'FRIEND'
                                ? '已是好友'
                                : person.relationshipState === 'OUTGOING_PENDING'
                                  ? '已申请'
                                  : '暂不可申请'}
                            </Badge>
                          )}
                        </Group>
                      </PersonRow>
                    ))
                  ) : (
                    <EmptyState
                      text={`附近 ${radiusMeters?.toLocaleString()} 米内暂无可发现的用户，稍后再来看看。`}
                    />
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </Tabs.Panel>

        {(['incoming', 'outgoing'] as const).map((direction) => (
          <Tabs.Panel className={styles.listSection} key={direction} value={direction} mt="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>
                {direction === 'incoming'
                  ? '\u6536\u5230\u7684\u7533\u8bf7'
                  : '\u53d1\u51fa\u7684\u7533\u8bf7'}
              </Text>
              <Chip.Group
                multiple={false}
                value={requestFilters[direction]}
                onChange={(value) => {
                  if (value === 'ALL' || value in requestStatusLabels) {
                    setRequestFilters((previous) => ({ ...previous, [direction]: value }));
                  }
                }}
              >
                <Group gap="xs" role="group" aria-label={'\u7533\u8bf7\u72b6\u6001'}>
                  <Chip value="ALL" size="sm">
                    {'\u5168\u90e8'}
                  </Chip>
                  {Object.entries(requestStatusLabels).map(([value, item]) => (
                    <Chip key={value} value={value} size="sm">
                      {item.label}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Group>
            {tab === direction ? (
              requests.isPending ? (
                <Loading />
              ) : requests.isError ? (
                <QueryError onRetry={() => void requests.refetch()} />
              ) : (
                <Stack gap="sm">
                  {requests.data?.items.map((request) => (
                    <PersonRow
                      key={request.requestId}
                      username={request.username}
                      detail={`申请于 ${new Date(request.requestedAt).toLocaleString('zh-CN')}`}
                    >
                      <Group gap="xs">
                        <Badge color={requestStatusLabels[request.status].color} variant="light">
                          {requestStatusLabels[request.status].label}
                        </Badge>
                        {request.status === 'PENDING' && direction === 'incoming' ? (
                          <>
                            <Button
                              disabled={pending}
                              onClick={() =>
                                act({ action: 'accept', requestId: request.requestId })
                              }
                              size="sm"
                            >
                              同意
                            </Button>
                            <Button
                              disabled={pending}
                              onClick={() =>
                                act({ action: 'reject', requestId: request.requestId })
                              }
                              size="sm"
                              variant="default"
                            >
                              拒绝
                            </Button>
                          </>
                        ) : (
                          <>
                            {request.status === 'PENDING' ? (
                              <Button
                                disabled={pending}
                                onClick={() =>
                                  act({ action: 'cancel', requestId: request.requestId })
                                }
                                size="sm"
                                variant="default"
                              >
                                撤回
                              </Button>
                            ) : null}
                          </>
                        )}
                      </Group>
                    </PersonRow>
                  ))}
                  {requests.data?.items.length === 0 ? (
                    <EmptyState text={'\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u7533\u8bf7'} />
                  ) : null}
                </Stack>
              )
            ) : null}
          </Tabs.Panel>
        ))}

        <Tabs.Panel className={styles.listSection} value="friends" mt="lg">
          {friends.isPending ? (
            <Loading />
          ) : friends.isError ? (
            <QueryError onRetry={() => void friends.refetch()} />
          ) : (
            <Stack gap="sm">
              {friends.data?.items.map((friend) => (
                <PersonRow
                  key={friend.relationshipId}
                  username={friend.username}
                  detail={`添加于 ${new Date(friend.createdAt).toLocaleDateString('zh-CN')}`}
                >
                  <Button
                    color="red"
                    disabled={pending}
                    onClick={() => setRemoveId(friend.relationshipId)}
                    size="sm"
                    variant="subtle"
                  >
                    删除好友
                  </Button>
                </PersonRow>
              ))}
              {friends.data?.items.length === 0 ? (
                <EmptyState text="还没有好友，去附近的人中认识新朋友吧。" />
              ) : null}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={consentOpen} onClose={() => setConsentOpen(false)} title="开启定位" centered>
        <Stack>
          <Text size="sm">
            开启后，应用将在窗口可见时每 {refreshSeconds}{' '}
            秒获取并同步一次位置，用于搜索附近的人。坐标由应用后端发送至高德地图解析地址，仅用于显示。
          </Text>
          <Text size="sm" c="dimmed">
            只有开启“允许附近的人发现我”，你才会出现在其他人的列表中。关闭定位会删除已保存的位置，不保留移动轨迹。
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConsentOpen(false)}>
              取消
            </Button>
            <Button
              className={styles.primaryButton}
              loading={settingsMutation.isPending}
              onClick={() => changeSettings(true, false)}
            >
              确认开启
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={removeId !== null} onClose={() => setRemoveId(null)} title="删除好友" centered>
        <Stack>
          <Text>确定删除这位好友吗？删除后，需要重新申请才能再次成为好友。</Text>
          <Button
            color="red"
            loading={pending}
            onClick={() => removeId && act({ action: 'remove', relationshipId: removeId })}
          >
            确认删除
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function PersonRow({
  username,
  detail,
  children,
}: {
  username: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <Card className={styles.personRow} padding="md">
      <Group justify="space-between" wrap="wrap">
        <Group>
          <Avatar radius="xl" color="blue">
            {username.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <Text fw={600}>{username}</Text>
            <Text c="dimmed" size="sm">
              {detail}
            </Text>
          </div>
        </Group>
        {children}
      </Group>
    </Card>
  );
}

function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Stack className={styles.emptyPanel} align="center" justify="center" gap="sm">
      <Box className={styles.emptyIcon}>
        <Users aria-hidden size={24} />
      </Box>
      <Text c="dimmed" size="sm" ta="center">
        {text}
      </Text>
      {action}
    </Stack>
  );
}

function Loading() {
  return (
    <Center p="xl">
      <Loader />
    </Center>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center p="xl">
      <Button onClick={onRetry} size="xs" variant="light">
        重试
      </Button>
    </Center>
  );
}
