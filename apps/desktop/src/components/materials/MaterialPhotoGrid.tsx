import {
  Alert,
  AspectRatio,
  Button,
  Card,
  Center,
  Drawer,
  Image,
  Loader,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  Clock3,
  FileImage,
  FolderOpen,
  HardDrive,
  ImageOff,
  Images,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  getMaterialProjectPhotosPage,
  MATERIAL_QUERY_STALE_TIME,
  materialProjectPhotosQueryKey,
  type MaterialPhoto,
  type MaterialPhotoPage,
} from '../../api/materials';
import styles from '../../styles/components/photos/PhotoGrid.module.css';

export function MaterialPhotoGrid({ projectId }: { projectId: string }) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const photosQuery = useInfiniteQuery<
    MaterialPhotoPage,
    Error,
    InfiniteData<MaterialPhotoPage, string | null>,
    ReturnType<typeof materialProjectPhotosQueryKey>,
    string | null
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getMaterialProjectPhotosPage(projectId, pageParam),
    queryKey: materialProjectPhotosQueryKey(projectId),
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = photosQuery;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;

    if (!sentinel || !hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  if (photosQuery.isLoading) {
    return <MaterialPhotoGridSkeleton />;
  }

  if (photosQuery.isError && !photosQuery.data) {
    return (
      <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="照片加载失败">
        <Stack align="flex-start" gap="sm">
          <Text size="sm">暂时无法加载这个图库的照片，请检查服务连接后重试。</Text>
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

  const photos = photosQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? null;

  if (photos.length === 0) {
    return (
      <Center className={styles.emptyState}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            <Images aria-hidden size={24} />
          </div>
          <Text fw={650}>这个图库还没有照片</Text>
          <Text c="dimmed" size="sm">
            该成员尚未在此图库中添加照片素材。
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <SimpleGrid className={styles.photoGrid} cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
        {photos.map((photo) => (
          <MaterialPhotoCard
            isSelected={photo.id === selectedPhotoId}
            key={photo.id}
            onSelect={() => setSelectedPhotoId(photo.id)}
            photo={photo}
          />
        ))}
      </SimpleGrid>

      {hasNextPage ? (
        <div
          aria-label="继续加载照片"
          className={styles.loadMoreSentinel}
          ref={loadMoreSentinelRef}
        >
          {isFetchNextPageError ? (
            <Stack align="center" gap="xs">
              <Text c="red" size="sm">
                下一页加载失败
              </Text>
              <Button
                color="red"
                onClick={() => void photosQuery.fetchNextPage()}
                size="xs"
                variant="subtle"
              >
                重试
              </Button>
            </Stack>
          ) : isFetchingNextPage ? (
            <Center>
              <Loader aria-label="正在加载更多照片" size="sm" />
            </Center>
          ) : null}
        </div>
      ) : null}

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
        title="素材详情"
      >
        {selectedPhoto ? (
          <MaterialPhotoDetail key={selectedPhoto.id} photo={selectedPhoto} />
        ) : null}
      </Drawer>
    </>
  );
}

type MaterialPhotoCardProps = {
  isSelected: boolean;
  onSelect: () => void;
  photo: MaterialPhoto;
};

function MaterialPhotoCard({ isSelected, onSelect, photo }: MaterialPhotoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

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
        {imageFailed ? (
          <Center className={styles.imageError}>
            <ImageOff aria-hidden size={26} />
          </Center>
        ) : (
          <Image
            alt={photo.fileName}
            className={styles.photoImage}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={photo.originalUrl}
          />
        )}
      </AspectRatio>
      <Stack className={styles.photoInfo} gap={2}>
        <Text fw={600} lineClamp={1} size="sm" title={photo.fileName}>
          {photo.fileName}
        </Text>
        <Text c="dimmed" size="xs">
          {formatFileSize(photo.sizeBytes)} · {photo.projectName}
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

function MaterialPhotoDetail({ photo }: { photo: MaterialPhoto }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div>
      <AspectRatio className={styles.detailImageFrame} ratio={4 / 3}>
        {imageFailed ? (
          <Center className={styles.detailImageError}>
            <Stack align="center" gap={6}>
              <ImageOff aria-hidden size={28} />
              <Text size="xs">原图加载失败</Text>
            </Stack>
          </Center>
        ) : (
          <Image
            alt={photo.fileName}
            className={styles.detailImage}
            onError={() => setImageFailed(true)}
            src={photo.originalUrl}
          />
        )}
      </AspectRatio>

      <dl className={styles.metadataList}>
        <Metadata icon={<FileImage size={17} />} label="文件名" value={photo.fileName} />
        <Metadata icon={<FolderOpen size={17} />} label="所属图库" value={photo.projectName} />
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

function MaterialPhotoGridSkeleton() {
  return (
    <SimpleGrid aria-label="正在加载照片" cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} height={190} radius="md" />
      ))}
    </SimpleGrid>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}
