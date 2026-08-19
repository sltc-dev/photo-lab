import { Alert, Box, Button, Group, Skeleton, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  getMaterialUserProjects,
  getMaterialUsers,
  MATERIAL_QUERY_STALE_TIME,
  materialUserProjectsQueryKey,
  materialUsersQueryKey,
} from '../api/materials';
import { MaterialPhotoGrid } from '../components/materials/MaterialPhotoGrid';
import styles from '../styles/pages/ProjectPhotosPage.module.css';

export function MaterialProjectPhotosPage() {
  const { projectId, userId } = useParams<{ projectId: string; userId: string }>();

  if (!projectId || !userId) {
    return <Navigate replace to="/materials" />;
  }

  return <MaterialProjectPhotosContent projectId={projectId} userId={userId} />;
}

function MaterialProjectPhotosContent({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const [activePhotoTab, setActivePhotoTab] = useState<'edited' | 'original'>('original');
  const usersQuery = useQuery({
    queryFn: getMaterialUsers,
    queryKey: materialUsersQueryKey,
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });
  const projectsQuery = useQuery({
    queryFn: () => getMaterialUserProjects(userId),
    queryKey: materialUserProjectsQueryKey(userId),
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });

  if (projectsQuery.isLoading) {
    return (
      <Stack className={styles.page} gap="lg">
        <Skeleton height={142} radius="md" />
        <Skeleton height={420} radius="md" />
      </Stack>
    );
  }

  const project = projectsQuery.data?.find((item) => item.id === projectId);

  if (projectsQuery.isError || !project) {
    return (
      <Stack className={styles.page}>
        <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="图库加载失败">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">图库不存在，或者暂时无法连接服务。</Text>
            <Button
              component={Link}
              leftSection={<ArrowLeft aria-hidden size={16} />}
              to={`/materials/users/${userId}`}
              variant="light"
            >
              返回成员图库
            </Button>
          </Group>
        </Alert>
      </Stack>
    );
  }

  const userName = usersQuery.data?.find((item) => item.id === userId)?.userName;

  return (
    <Stack className={styles.page} gap="lg">
      <Box className={styles.pageHeader}>
        <Button
          className={styles.backButton}
          component={Link}
          leftSection={<ArrowLeft aria-hidden size={17} />}
          size="compact-sm"
          to={`/materials/users/${userId}`}
          variant="subtle"
        >
          返回成员图库
        </Button>
        <Group align="flex-end" justify="space-between" mt="md" wrap="wrap">
          <Box className={styles.titleBlock}>
            <Title className={styles.title} order={2}>
              {project.name}
            </Title>
            <Text c="dimmed" mt={5} size="sm">
              {project.description || '暂无项目描述'}
            </Text>
            <Text className={styles.photoCount} mt="sm" size="sm">
              {project.photoCount} 张照片{userName ? ` · 来自 ${userName}` : ''}
            </Text>
          </Box>
        </Group>
      </Box>

      <section aria-label="素材照片" className={styles.gallerySection}>
        <Tabs
          className={styles.photoTabs}
          classNames={{
            list: styles.photoTabList,
            tab: styles.photoTab,
          }}
          keepMounted={false}
          onChange={(value) => setActivePhotoTab(value === 'edited' ? 'edited' : 'original')}
          value={activePhotoTab}
        >
          <Group align="flex-end" className={styles.galleryHeader} justify="space-between">
            <Tabs.List aria-label="照片类型">
              <Tabs.Tab value="original">原图</Tabs.Tab>
              <Tabs.Tab value="edited">效果图</Tabs.Tab>
            </Tabs.List>
            <Text c="dimmed" size="sm">
              按上传时间从新到旧排列
            </Text>
          </Group>
          <Tabs.Panel value="original">
            <MaterialPhotoGrid kind="ORIGINAL" projectId={projectId} />
          </Tabs.Panel>
          <Tabs.Panel value="edited">
            <MaterialPhotoGrid kind="EDITED" projectId={projectId} />
          </Tabs.Panel>
        </Tabs>
      </section>
    </Stack>
  );
}
