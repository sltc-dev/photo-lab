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
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronRight, Image, Images } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  getMaterialUserProjects,
  getMaterialUsers,
  MATERIAL_QUERY_STALE_TIME,
  materialUserProjectsQueryKey,
  materialUsersQueryKey,
} from '../api/materials';
import styles from '../styles/pages/HomePage.module.css';

export function MaterialUserProjectsPage() {
  const { userId } = useParams<{ userId: string }>();

  if (!userId) {
    return <Navigate replace to="/materials" />;
  }

  return <MaterialUserProjectsContent userId={userId} />;
}

function MaterialUserProjectsContent({ userId }: { userId: string }) {
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
  const user = usersQuery.data?.find((item) => item.id === userId);
  const projects = projectsQuery.data ?? [];
  const totalPhotoCount = projects.reduce((total, project) => total + project.photoCount, 0);

  return (
    <Stack className={styles.content} gap="lg">
      <Box className={styles.pageHeading}>
        <Button
          component={Link}
          leftSection={<ArrowLeft aria-hidden size={17} />}
          ml={-8}
          size="compact-sm"
          to="/materials"
          variant="subtle"
        >
          返回素材库
        </Button>
        <Text className={styles.eyebrow} mt="md">
          素材库 · 成员图库
        </Text>
        <Title className={styles.pageTitle} order={2}>
          {user ? `${user.userName} 的图库` : '成员图库'}
        </Title>
        <Text c="dimmed" mt={6}>
          选择一个图库，继续浏览其中的全部照片。
        </Text>
      </Box>

      <SimpleGrid className={styles.statsGrid} cols={{ base: 1, xs: 2 }}>
        <Card className={styles.statCard} padding="lg">
          <Group justify="space-between">
            <Box>
              <Text className={styles.statLabel}>图库项目</Text>
              <Text className={styles.statValue}>{projects.length}</Text>
            </Box>
            <div className={styles.statIcon}>
              <Images aria-hidden size={20} />
            </div>
          </Group>
        </Card>
        <Card className={styles.statCard} padding="lg">
          <Group justify="space-between">
            <Box>
              <Text className={styles.statLabel}>照片总数</Text>
              <Text className={styles.statValue}>{totalPhotoCount}</Text>
            </Box>
            <div className={styles.statIcon}>
              <Image aria-hidden size={20} />
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      <section aria-labelledby="material-project-list-title" className={styles.projectsSection}>
        <Group className={styles.sectionToolbar} justify="space-between">
          <Box>
            <Title className={styles.sectionTitle} id="material-project-list-title" order={3}>
              全部图库
            </Title>
            <Text c="dimmed" size="sm">
              {projects.length > 0 ? `共 ${projects.length} 个图库` : '暂无可浏览图库'}
            </Text>
          </Box>
        </Group>

        <ProjectContent
          isError={projectsQuery.isError}
          isLoading={projectsQuery.isLoading}
          projects={projects}
          userId={userId}
        />
      </section>
    </Stack>
  );
}

type ProjectContentProps = {
  isError: boolean;
  isLoading: boolean;
  projects: Awaited<ReturnType<typeof getMaterialUserProjects>>;
  userId: string;
};

function ProjectContent({ isError, isLoading, projects, userId }: ProjectContentProps) {
  if (isLoading) {
    return (
      <Grid aria-label="正在加载图库" className={styles.projectGrid}>
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
      <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="图库加载失败">
        <Text size="sm">该成员不存在，或者暂时无法连接服务。</Text>
      </Alert>
    );
  }

  if (projects.length === 0) {
    return (
      <Center className={styles.emptyPanel}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            <Images aria-hidden size={24} />
          </div>
          <Title order={3}>该成员还没有图库</Title>
          <Text>图库创建后会自动出现在这里。</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Grid className={styles.projectGrid}>
      {projects.map((project) => (
        <Grid.Col key={project.id} span={{ base: 12, md: 6, xl: 4 }}>
          <Card
            className={styles.projectCard}
            component={Link}
            padding="lg"
            to={`/materials/users/${userId}/projects/${project.id}`}
          >
            <Group align="flex-start" justify="space-between" wrap="nowrap">
              <div className={styles.projectIcon}>
                <Images aria-hidden size={21} />
              </div>
              <div className={styles.openProjectIcon}>
                <ChevronRight aria-hidden size={19} />
              </div>
            </Group>
            <Title className={styles.projectTitle} order={4}>
              {project.name}
            </Title>
            <Text className={styles.projectDescription} lineClamp={2}>
              {project.description || '暂无项目描述'}
            </Text>
            <Group className={styles.projectMeta} justify="space-between">
              <Text fw={600} size="sm">
                {project.photoCount} 张照片
              </Text>
              <Text c="dimmed" size="xs">
                创建于 {formatProjectDate(project.createdAt)}
              </Text>
            </Group>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}

const projectDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatProjectDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知日期' : projectDateFormatter.format(date);
}
