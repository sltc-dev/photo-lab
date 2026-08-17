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
import { notifications } from '@mantine/notifications';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  Clock3,
  FileImage,
  FolderOpen,
  HardDrive,
  Heart,
  ImageOff,
  Images,
  Maximize2,
  RefreshCw,
  Star,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  getMaterialFavoritePhotosPage,
  getMaterialProjectPhotosPage,
  MATERIAL_QUERY_STALE_TIME,
  materialFavoritePhotosQueryKey,
  materialProjectPhotosQueryKey,
  setMaterialPhotoFavorite,
  setMaterialPhotoLike,
  type MaterialPhoto,
  type MaterialPhotoKind,
  type MaterialPhotoPage,
} from '../../api/materials';
import { getApiErrorMessage } from '../../api/http';
import styles from '../../styles/components/photos/PhotoGrid.module.css';

type MaterialPhotoGridProps = {
  kind: MaterialPhotoKind;
} & ({ favoritesOnly: true; projectId?: never } | { favoritesOnly?: false; projectId: string });

export function MaterialPhotoGrid(props: MaterialPhotoGridProps) {
  const { kind } = props;
  const isFavoritesView = props.favoritesOnly === true;
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const queryKey = isFavoritesView
    ? materialFavoritePhotosQueryKey(kind)
    : materialProjectPhotosQueryKey(props.projectId, kind);
  const photosQuery = useInfiniteQuery<
    MaterialPhotoPage,
    Error,
    InfiniteData<MaterialPhotoPage, string | null>,
    typeof queryKey,
    string | null
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      isFavoritesView
        ? getMaterialFavoritePhotosPage(pageParam, kind)
        : getMaterialProjectPhotosPage(props.projectId, pageParam, kind),
    queryKey,
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });
  const likeMutation = useMutation({
    mutationFn: ({ isLiked, photoId }: { isLiked: boolean; photoId: string }) =>
      setMaterialPhotoLike(photoId, isLiked),
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '点赞操作失败',
      });
    },
    onSuccess: (state) => {
      updateCachedMaterialPhoto(queryClient, state.photoId, (photo) => ({
        ...photo,
        isLiked: state.isLiked,
        likeCount: state.likeCount,
      }));
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: ({ isFavorited, photoId }: { isFavorited: boolean; photoId: string }) =>
      setMaterialPhotoFavorite(photoId, isFavorited),
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '收藏操作失败',
      });
    },
    onSuccess: (state) => {
      updateCachedMaterialPhoto(queryClient, state.photoId, (photo) => ({
        ...photo,
        isFavorited: state.isFavorited,
      }));
      void queryClient.invalidateQueries({ queryKey: ['materials', 'favorites'] });
      if (!state.isFavorited && isFavoritesView) {
        setSelectedPhotoId(null);
      }
    },
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
          <Text size="sm">暂时无法加载照片，请检查服务连接后重试。</Text>
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
    const isEditedKind = kind === 'EDITED';

    return (
      <Center className={styles.emptyState}>
        <Stack align="center" gap="sm">
          <div className={styles.emptyIcon}>
            <Images aria-hidden size={24} />
          </div>
          <Text fw={650}>{isEditedKind ? '暂无效果图' : '暂无原图'}</Text>
          <Text c="dimmed" size="sm">
            {isFavoritesView
              ? `你还没有收藏任何${isEditedKind ? '效果图' : '原图'}。`
              : isEditedKind
                ? '该成员尚未在此图库中生成效果图。'
                : '该成员尚未在此图库中添加原始照片。'}
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
            favoritePending={
              favoriteMutation.isPending && favoriteMutation.variables?.photoId === photo.id
            }
            isSelected={photo.id === selectedPhotoId}
            key={photo.id}
            likePending={likeMutation.isPending && likeMutation.variables?.photoId === photo.id}
            onSelect={() => setSelectedPhotoId(photo.id)}
            onToggleFavorite={() =>
              favoriteMutation.mutate({ isFavorited: !photo.isFavorited, photoId: photo.id })
            }
            onToggleLike={() => likeMutation.mutate({ isLiked: !photo.isLiked, photoId: photo.id })}
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
          <MaterialPhotoDetail
            favoritePending={
              favoriteMutation.isPending && favoriteMutation.variables?.photoId === selectedPhoto.id
            }
            key={selectedPhoto.id}
            likePending={
              likeMutation.isPending && likeMutation.variables?.photoId === selectedPhoto.id
            }
            onToggleFavorite={() =>
              favoriteMutation.mutate({
                isFavorited: !selectedPhoto.isFavorited,
                photoId: selectedPhoto.id,
              })
            }
            onToggleLike={() =>
              likeMutation.mutate({
                isLiked: !selectedPhoto.isLiked,
                photoId: selectedPhoto.id,
              })
            }
            photo={selectedPhoto}
          />
        ) : null}
      </Drawer>
    </>
  );
}

type MaterialPhotoCardProps = {
  favoritePending: boolean;
  isSelected: boolean;
  likePending: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleLike: () => void;
  photo: MaterialPhoto;
};

function MaterialPhotoCard({
  favoritePending,
  isSelected,
  likePending,
  onSelect,
  onToggleFavorite,
  onToggleLike,
  photo,
}: MaterialPhotoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Card
      className={`${styles.photoCard} ${isSelected ? styles.selectedPhotoCard : ''}`}
      padding={0}
    >
      <button
        aria-label={`查看 ${photo.fileName} 详情`}
        className={styles.photoSelectButton}
        onClick={onSelect}
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
      </button>
      <PhotoReactionBar
        favoritePending={favoritePending}
        likePending={likePending}
        onToggleFavorite={onToggleFavorite}
        onToggleLike={onToggleLike}
        photo={photo}
        variant="overlay"
      />
    </Card>
  );
}

type PhotoReactionProps = {
  favoritePending: boolean;
  likePending: boolean;
  onToggleFavorite: () => void;
  onToggleLike: () => void;
  photo: MaterialPhoto;
};

function MaterialPhotoDetail({
  favoritePending,
  likePending,
  onToggleFavorite,
  onToggleLike,
  photo,
}: PhotoReactionProps) {
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

      <PhotoReactionBar
        favoritePending={favoritePending}
        likePending={likePending}
        onToggleFavorite={onToggleFavorite}
        onToggleLike={onToggleLike}
        photo={photo}
      />

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

function PhotoReactionBar({
  favoritePending,
  likePending,
  onToggleFavorite,
  onToggleLike,
  photo,
  variant = 'detail',
}: PhotoReactionProps & { variant?: 'detail' | 'overlay' }) {
  const isOverlay = variant === 'overlay';

  return (
    <div className={`${styles.reactionBar} ${isOverlay ? styles.overlayReactionBar : ''}`}>
      <button
        aria-label={`${photo.isLiked ? '取消点赞' : '点赞'} ${photo.fileName}`}
        aria-pressed={photo.isLiked}
        className={`${styles.reactionButton} ${photo.isLiked ? styles.likedReaction : ''}`}
        disabled={likePending}
        onClick={onToggleLike}
        title={photo.isLiked ? '取消点赞' : '点赞'}
        type="button"
      >
        <Heart
          aria-hidden
          fill={photo.isLiked ? 'currentColor' : 'none'}
          size={isOverlay ? 11 : 21}
        />
        <span>{photo.likeCount}</span>
      </button>
      <button
        aria-label={`${photo.isFavorited ? '取消收藏' : '收藏'} ${photo.fileName}`}
        aria-pressed={photo.isFavorited}
        className={`${styles.reactionButton} ${photo.isFavorited ? styles.favoritedReaction : ''}`}
        disabled={favoritePending}
        onClick={onToggleFavorite}
        title={photo.isFavorited ? '取消收藏' : '收藏'}
        type="button"
      >
        <Star
          aria-hidden
          fill={photo.isFavorited ? 'currentColor' : 'none'}
          size={isOverlay ? 11 : 21}
        />
        {!isOverlay ? <span>{photo.isFavorited ? '已收藏' : '收藏'}</span> : null}
      </button>
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

function updateCachedMaterialPhoto(
  queryClient: ReturnType<typeof useQueryClient>,
  photoId: string,
  update: (photo: MaterialPhoto) => MaterialPhoto,
) {
  const updatePages = (data: InfiniteData<MaterialPhotoPage, string | null> | undefined) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((photo) => (photo.id === photoId ? update(photo) : photo)),
          })),
        }
      : data;

  queryClient.setQueriesData<InfiniteData<MaterialPhotoPage, string | null>>(
    { queryKey: ['materials', 'projects'] },
    updatePages,
  );
  queryClient.setQueriesData<InfiniteData<MaterialPhotoPage, string | null>>(
    { queryKey: ['materials', 'favorites'] },
    updatePages,
  );
}
