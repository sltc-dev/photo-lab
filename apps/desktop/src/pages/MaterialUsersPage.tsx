import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  Grid,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaterialUsers,
  MATERIAL_QUERY_STALE_TIME,
  materialUsersQueryKey,
} from '../api/materials';
import styles from '../styles/pages/HomePage.module.css';

const emptyUsers: Awaited<ReturnType<typeof getMaterialUsers>> = [];

export function MaterialUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const usersQuery = useQuery({
    queryFn: getMaterialUsers,
    queryKey: materialUsersQueryKey,
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });
  const users = usersQuery.data ?? emptyUsers;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('zh-CN');
  const visibleUsers = useMemo(() => {
    if (!normalizedSearchQuery) {
      return users;
    }

    return users.filter((user) =>
      user.userName.toLocaleLowerCase('zh-CN').includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, users]);
  const totalProjectCount = users.reduce((total, user) => total + user.projectCount, 0);

  return (
    <Stack className={styles.content} gap="lg">
      <Box className={styles.pageHeading}>
        <Text className={styles.eyebrow}>工作区</Text>
        <Title className={styles.pageTitle} order={2}>
          素材库
        </Title>
        <Text c="dimmed" mt={6}>
          浏览团队成员共享的图库与照片素材。
        </Text>
      </Box>

      <SimpleGrid className={styles.statsGrid} cols={{ base: 1, xs: 2 }}>
        <Card className={styles.statCard} padding="lg">
          <Group justify="space-between">
            <Box>
              <Text className={styles.statLabel}>团队成员</Text>
              <Text className={styles.statValue}>{users.length}</Text>
            </Box>
            <div className={styles.statIcon}>
              <UsersRound aria-hidden size={20} />
            </div>
          </Group>
        </Card>
        <Card className={styles.statCard} padding="lg">
          <Group justify="space-between">
            <Box>
              <Text className={styles.statLabel}>共享图库</Text>
              <Text className={styles.statValue}>{totalProjectCount}</Text>
            </Box>
            <div className={styles.statIcon}>
              <FolderOpen aria-hidden size={20} />
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      <section aria-labelledby="material-user-list-title" className={styles.projectsSection}>
        <Group className={styles.sectionToolbar} justify="space-between">
          <Box>
            <Title className={styles.sectionTitle} id="material-user-list-title" order={3}>
              全部成员
            </Title>
            <Text c="dimmed" size="sm">
              {users.length > 0 ? `共 ${users.length} 位成员` : '暂无可浏览成员'}
            </Text>
          </Box>
          <TextInput
            aria-label="搜索成员"
            className={styles.searchInput}
            leftSection={<Search aria-hidden size={17} />}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="搜索成员名称"
            value={searchQuery}
          />
        </Group>

        <UserContent
          hasSearch={Boolean(normalizedSearchQuery)}
          isError={usersQuery.isError}
          isLoading={usersQuery.isLoading}
          onRetry={() => void usersQuery.refetch()}
          users={visibleUsers}
        />
      </section>
    </Stack>
  );
}

type UserContentProps = {
  hasSearch: boolean;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  users: Awaited<ReturnType<typeof getMaterialUsers>>;
};

function UserContent({ hasSearch, isError, isLoading, onRetry, users }: UserContentProps) {
  if (isLoading) {
    return (
      <Grid aria-label="正在加载成员" className={styles.projectGrid}>
        {[0, 1, 2].map((item) => (
          <Grid.Col key={item} span={{ base: 12, md: 6, xl: 4 }}>
            <Skeleton height={194} radius="md" />
          </Grid.Col>
        ))}
      </Grid>
    );
  }

  if (isError) {
    return (
      <Alert
        className={styles.errorAlert}
        color="red"
        icon={<AlertCircle aria-hidden size={20} />}
        title="成员加载失败"
      >
        <Group justify="space-between" wrap="wrap">
          <Text size="sm">暂时无法获取素材库成员，请检查服务连接后重试。</Text>
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

  if (users.length === 0) {
    return (
      <Center className={styles.emptyPanel}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            {hasSearch ? <Search aria-hidden size={24} /> : <UsersRound aria-hidden size={24} />}
          </div>
          <Title order={3}>{hasSearch ? '没有匹配的成员' : '暂无其他团队成员'}</Title>
          <Text>
            {hasSearch ? '尝试搜索其他成员名称。' : '有其他用户加入后，可在这里浏览共享素材。'}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Grid className={styles.projectGrid}>
      {users.map((user) => (
        <Grid.Col key={user.id} span={{ base: 12, md: 6, xl: 4 }}>
          <Card
            className={styles.projectCard}
            component={Link}
            padding="lg"
            to={`/materials/users/${user.id}`}
          >
            <Group align="flex-start" justify="space-between" wrap="nowrap">
              <div className={styles.projectIcon}>
                <UserRound aria-hidden size={21} />
              </div>
              <div className={styles.openProjectIcon}>
                <ChevronRight aria-hidden size={19} />
              </div>
            </Group>
            <Title className={styles.projectTitle} order={4}>
              {user.userName}
            </Title>
            <Text className={styles.projectDescription} lineClamp={2}>
              浏览该成员共享的图库和照片素材
            </Text>
            <Group className={styles.projectMeta} justify="space-between">
              <Text fw={600} size="sm">
                {user.projectCount} 个图库
              </Text>
              <Text c="dimmed" size="xs">
                查看素材
              </Text>
            </Group>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}
