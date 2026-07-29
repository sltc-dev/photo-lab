import {
  Alert,
  AspectRatio,
  Button,
  Card,
  Center,
  Drawer,
  Image,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  Clock3,
  FileImage,
  HardDrive,
  ImageOff,
  Images,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import {
  getPhotoOriginal,
  getPhotoThumbnail,
  getProjectPhotos,
  photoOriginalQueryKey,
  photoThumbnailQueryKey,
  photosQueryKey,
  type ProjectPhoto,
} from '../../api/photos';
import styles from '../../styles/components/photos/PhotoGrid.module.css';

type PhotoGridProps = {
  projectId: string;
};

export function PhotoGrid({ projectId }: PhotoGridProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const photosQuery = useQuery({
    queryFn: () => getProjectPhotos(projectId),
    queryKey: photosQueryKey(projectId),
  });

  if (photosQuery.isLoading) {
    return <PhotoGridSkeleton />;
  }

  if (photosQuery.isError) {
    return (
      <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="照片加载失败">
        <Stack align="flex-start" gap="sm">
          <Text size="sm">暂时无法加载这个项目的照片，请检查服务连接后重试。</Text>
          <Button
            color="red"
            leftSection={<RefreshCw aria-hidden size={16} />}
            onClick={() => void photosQuery.refetch()}
            size="xs"
            variant="light"
          >
            重新加载
          </Button>
        </Stack>
      </Alert>
    );
  }

  const photos = photosQuery.data ?? [];
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? null;

  if (photos.length === 0) {
    return (
      <Center className={styles.emptyState}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            <Images aria-hidden size={24} />
          </div>
          <Text fw={650}>这个项目还没有照片</Text>
          <Text c="dimmed" size="sm">
            点击右上角“上传照片”，添加第一张原始图片。
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <SimpleGrid className={styles.photoGrid} cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
        {photos.map((photo) => (
          <PhotoGridItem
            isSelected={photo.id === selectedPhotoId}
            key={photo.id}
            onSelect={() => setSelectedPhotoId(photo.id)}
            photo={photo}
          />
        ))}
      </SimpleGrid>
      <Drawer
        classNames={{
          body: styles.drawerBody,
          content: styles.drawerContent,
          header: styles.drawerHeader,
          title: styles.drawerTitle,
        }}
        closeButtonProps={{ 'aria-label': '关闭照片详情' }}
        onClose={() => setSelectedPhotoId(null)}
        opened={Boolean(selectedPhoto)}
        overlayProps={{ backgroundOpacity: 0.28, blur: 1 }}
        position="right"
        size={400}
        title="照片详情"
      >
        {selectedPhoto ? <PhotoDetail photo={selectedPhoto} /> : null}
      </Drawer>
    </>
  );
}

type PhotoGridItemProps = {
  isSelected: boolean;
  onSelect: () => void;
  photo: ProjectPhoto;
};

function PhotoGridItem({ isSelected, onSelect, photo }: PhotoGridItemProps) {
  const thumbnailQuery = useQuery({
    gcTime: 5 * 60 * 1000,
    queryFn: () => getPhotoThumbnail(photo.projectId, photo.id),
    queryKey: photoThumbnailQueryKey(photo.projectId, photo.id),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const imageUrl = useObjectUrl(thumbnailQuery.data);

  return (
    <Card
      aria-label={`查看 ${photo.fileName} 详情`}
      className={`${styles.photoCard} ${isSelected ? styles.selectedPhotoCard : ''}`}
      component="button"
      onClick={onSelect}
      padding={0}
      type="button"
    >
      <AspectRatio ratio={4 / 3}>
        {thumbnailQuery.isLoading ? <Skeleton height="100%" /> : null}
        {thumbnailQuery.isError ? (
          <Center className={styles.imageError}>
            <ImageOff aria-hidden size={26} />
          </Center>
        ) : null}
        {imageUrl ? (
          <Image alt={photo.fileName} className={styles.photoImage} loading="lazy" src={imageUrl} />
        ) : null}
      </AspectRatio>
      <Stack className={styles.photoInfo} gap={2}>
        <Text fw={600} lineClamp={1} size="sm" title={photo.fileName}>
          {photo.fileName}
        </Text>
        <Text c="dimmed" size="xs">
          {formatFileSize(photo.sizeBytes)}
        </Text>
      </Stack>
      {isSelected ? (
        <span aria-hidden className={styles.selectedMark}>
          <Check size={14} strokeWidth={3} />
        </span>
      ) : null}
    </Card>
  );
}

function PhotoDetail({ photo }: { photo: ProjectPhoto }) {
  const originalQuery = useQuery({
    gcTime: 5 * 60 * 1000,
    queryFn: () => getPhotoOriginal(photo.projectId, photo.id),
    queryKey: photoOriginalQueryKey(photo.projectId, photo.id),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const imageUrl = useObjectUrl(originalQuery.data);

  return (
    <div>
      <AspectRatio className={styles.detailImageFrame} ratio={4 / 3}>
        {originalQuery.isLoading ? <Skeleton height="100%" /> : null}
        {originalQuery.isError ? (
          <Center className={styles.detailImageError}>
            <Stack align="center" gap={6}>
              <ImageOff aria-hidden size={28} />
              <Text size="xs">原图加载失败</Text>
            </Stack>
          </Center>
        ) : null}
        {imageUrl ? (
          <Image alt={photo.fileName} className={styles.detailImage} src={imageUrl} />
        ) : null}
      </AspectRatio>

      <dl className={styles.metadataList}>
        <Metadata icon={<FileImage size={17} />} label="文件名" value={photo.fileName} />
        <Metadata
          icon={<Maximize2 size={17} />}
          label="尺寸"
          value={photo.width && photo.height ? `${photo.width} × ${photo.height}` : '—'}
        />
        <Metadata
          icon={<HardDrive size={17} />}
          label="大小"
          value={formatFileSize(photo.sizeBytes)}
        />
        <Metadata
          icon={<Clock3 size={17} />}
          label="上传时间"
          value={formatDateTime(photo.createdAt)}
        />
      </dl>
    </div>
  );
}

function Metadata({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={styles.metadataRow}>
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function PhotoGridSkeleton() {
  return (
    <SimpleGrid aria-label="正在加载照片" cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} height={190} radius="md" />
      ))}
    </SimpleGrid>
  );
}

function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [blob]);

  return url;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
