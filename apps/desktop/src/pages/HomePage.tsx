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
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronRight,
  FolderPlus,
  Image,
  Images,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/http';
import { addProject, getProjects, projectsQueryKey } from '../api/projects';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import type { ProjectFormValues } from '../schemas/project.schema';
import styles from '../styles/pages/HomePage.module.css';

const emptyProjects: Awaited<ReturnType<typeof getProjects>> = [];

export function HomePage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const projectsQuery = useQuery({
    queryFn: getProjects,
    queryKey: projectsQueryKey,
  });

  const projects = projectsQuery.data ?? emptyProjects;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('zh-CN');
  const visibleProjects = useMemo(() => {
    if (!normalizedSearchQuery) {
      return projects;
    }

    return projects.filter((project) =>
      `${project.name} ${project.description}`
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, projects]);

  const totalPhotoCount = projects.reduce((total, project) => total + project.photoCount, 0);

  const createProjectMutation = useMutation({
    mutationFn: addProject,
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '项目创建失败',
      });
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getProjects>>>(
        projectsQueryKey,
        (currentProjects = []) => [project, ...currentProjects],
      );
      setIsCreateModalOpen(false);
      notifications.show({
        color: 'green',
        message: `“${project.name}”已加入图库`,
        title: '项目已创建',
      });
    },
  });

  return (
    <Stack className={styles.content} gap="lg">
      <Box className={styles.pageHeading}>
        <Text className={styles.eyebrow}>工作区</Text>
        <Title className={styles.pageTitle} order={2}>
          图库
        </Title>
        <Text c="dimmed" mt={6}>
          创建项目并集中管理每一次拍摄的照片。
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

      <section aria-labelledby="project-list-title" className={styles.projectsSection}>
        <Group className={styles.sectionToolbar} justify="space-between">
          <Box>
            <Title className={styles.sectionTitle} id="project-list-title" order={3}>
              全部项目
            </Title>
            <Text c="dimmed" size="sm">
              {projects.length > 0 ? `共 ${projects.length} 个项目` : '从第一个项目开始'}
            </Text>
          </Box>
          <Group className={styles.toolbarActions} gap="sm">
            <TextInput
              aria-label="搜索项目"
              className={styles.searchInput}
              leftSection={<Search aria-hidden size={17} />}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="搜索名称或描述"
              value={searchQuery}
            />
            <Button
              className={styles.createButton}
              leftSection={<FolderPlus aria-hidden size={18} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              新建项目
            </Button>
          </Group>
        </Group>

        <ProjectContent
          hasSearch={Boolean(normalizedSearchQuery)}
          isError={projectsQuery.isError}
          isLoading={projectsQuery.isLoading}
          onCreate={() => setIsCreateModalOpen(true)}
          onRetry={() => void projectsQuery.refetch()}
          projects={visibleProjects}
        />
      </section>

      {isCreateModalOpen ? (
        <CreateProjectModal
          isSubmitting={createProjectMutation.isPending}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(values: ProjectFormValues) =>
            createProjectMutation.mutate({
              description: values.description,
              name: values.name,
            })
          }
        />
      ) : null}
    </Stack>
  );
}

type ProjectContentProps = {
  hasSearch: boolean;
  isError: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onRetry: () => void;
  projects: Awaited<ReturnType<typeof getProjects>>;
};

function ProjectContent({
  hasSearch,
  isError,
  isLoading,
  onCreate,
  onRetry,
  projects,
}: ProjectContentProps) {
  if (isLoading) {
    return (
      <Grid aria-label="正在加载项目" className={styles.projectGrid}>
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
        title="项目加载失败"
      >
        <Group justify="space-between" wrap="wrap">
          <Text size="sm">暂时无法获取图库项目，请检查服务连接后重试。</Text>
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

  if (projects.length === 0) {
    return (
      <Center className={styles.emptyPanel}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            {hasSearch ? <Search aria-hidden size={24} /> : <Images aria-hidden size={24} />}
          </div>
          <Title order={3}>{hasSearch ? '没有匹配的项目' : '创建第一个图库项目'}</Title>
          <Text>
            {hasSearch
              ? '尝试搜索其他名称或描述。'
              : '按主题、客户或拍摄任务建立项目，开始整理你的照片。'}
          </Text>
          {hasSearch ? null : (
            <Button
              leftSection={<FolderPlus aria-hidden size={17} />}
              mt="xs"
              onClick={onCreate}
              variant="light"
            >
              新建项目
            </Button>
          )}
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
            to={`/projects/${project.id}`}
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
