import { Alert, Box, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/http';
import { photosQueryKey, uploadProjectPhoto } from '../api/photos';
import { getProjectById, getProjects, projectQueryKey, projectsQueryKey } from '../api/projects';
import { PhotoGrid } from '../components/photos/PhotoGrid';
import { PhotoUploadButton } from '../components/photos/PhotoUploadButton';
import styles from '../styles/pages/ProjectPhotosPage.module.css';

export function ProjectPhotosPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  if (!projectId) {
    return <Navigate replace to="/" />;
  }

  return <ProjectPhotosContent projectId={projectId} queryClient={queryClient} />;
}

type ProjectPhotosContentProps = {
  projectId: string;
  queryClient: ReturnType<typeof useQueryClient>;
};

function ProjectPhotosContent({ projectId, queryClient }: ProjectPhotosContentProps) {
  const projectQuery = useQuery({
    queryFn: () => getProjectById(projectId),
    queryKey: projectQueryKey(projectId),
  });
  const uploadMutation = useMutation({
    mutationFn: uploadProjectPhoto,
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '照片上传失败',
      });
    },
    onSuccess: (photo) => {
      void queryClient.invalidateQueries({
        queryKey: photosQueryKey(photo.projectId),
      });
      queryClient.setQueryData(
        projectQueryKey(photo.projectId),
        (project: Awaited<ReturnType<typeof getProjectById>> | undefined) =>
          project
            ? {
                ...project,
                photoCount: project.photoCount + 1,
              }
            : project,
      );
      queryClient.setQueryData<Awaited<ReturnType<typeof getProjects>>>(
        projectsQueryKey,
        (projects = []) =>
          projects.map((project) =>
            project.id === photo.projectId
              ? {
                  ...project,
                  photoCount: project.photoCount + 1,
                }
              : project,
          ),
      );
      notifications.show({
        color: 'green',
        message: `“${photo.fileName}”已加入项目`,
        title: '照片已上传',
      });
    },
  });

  if (projectQuery.isLoading) {
    return (
      <Stack className={styles.page} gap="lg">
        <Skeleton height={110} radius="md" />
        <Skeleton height={420} radius="md" />
      </Stack>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <Stack className={styles.page}>
        <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="项目加载失败">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">项目不存在，或者暂时无法连接服务。</Text>
            <Button component={Link} leftSection={<ArrowLeft size={16} />} to="/" variant="light">
              返回图库
            </Button>
          </Group>
        </Alert>
      </Stack>
    );
  }

  const project = projectQuery.data;

  return (
    <Stack className={styles.page} gap="lg">
      <Box className={styles.pageHeader}>
        <Button
          className={styles.backButton}
          component={Link}
          leftSection={<ArrowLeft aria-hidden size={17} />}
          size="compact-sm"
          to="/"
          variant="subtle"
        >
          返回图库
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
              {project.photoCount} 张照片
            </Text>
          </Box>
          <PhotoUploadButton
            className={styles.uploadButton}
            isUploading={uploadMutation.isPending}
            onSelectFile={(file) =>
              uploadMutation.mutate({
                file,
                projectId,
              })
            }
            onValidationError={(message) =>
              notifications.show({
                color: 'yellow',
                message,
                title: '无法上传这张照片',
              })
            }
          />
        </Group>
      </Box>

      <section aria-labelledby="photo-grid-title" className={styles.gallerySection}>
        <Group className={styles.galleryHeader} justify="space-between">
          <Title id="photo-grid-title" order={3}>
            全部照片
          </Title>
          <Text c="dimmed" size="sm">
            按上传时间从新到旧排列
          </Text>
        </Group>
        <PhotoGrid projectId={projectId} />
      </section>
    </Stack>
  );
}
