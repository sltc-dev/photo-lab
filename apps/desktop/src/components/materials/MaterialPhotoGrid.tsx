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
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
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
  MessageCircle,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  addMaterialPhotoComment,
  deleteMaterialSticker,
  getMaterialStickers,
  getMaterialPhotoComments,
  getMaterialFavoritePhotosPage,
  getMaterialProjectPhotosPage,
  MATERIAL_QUERY_STALE_TIME,
  materialFavoritePhotosQueryKey,
  materialProjectPhotosQueryKey,
  materialPhotoCommentsQueryKey,
  materialStickersQueryKey,
  removeMaterialPhotoComment,
  uploadMaterialSticker,
  setMaterialPhotoFavorite,
  setMaterialPhotoLike,
  type MaterialPhoto,
  type MaterialPhotoKind,
  type MaterialPhotoPage,
  type MaterialStickerKey,
} from '../../api/materials';
import { getApiErrorMessage, resolveApiUrl } from '../../api/http';
import styles from '../../styles/components/photos/PhotoGrid.module.css';
import stickerSheetUrl from '../../assets/material-stickers.png';

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

      <MaterialPhotoComments photo={photo} />
    </div>
  );
}

const QUICK_EMOJIS = ['👍', '❤️', '😍', '😂', '🎉', '🔥', '👏', '🤔'];
const STICKERS = ['like', 'laugh', 'love', 'celebrate', 'wow', 'think'] as const;
const HIDDEN_STICKERS_STORAGE_KEY = 'photo-lab:hidden-built-in-stickers';

function MaterialPhotoComments({ photo }: { photo: MaterialPhoto }) {
  const [content, setContent] = useState('');
  const [hiddenBuiltInStickers, setHiddenBuiltInStickers] = useState<string[]>(() =>
    readHiddenBuiltInStickers(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const queryKey = materialPhotoCommentsQueryKey(photo.id);
  const commentsQuery = useQuery({
    queryFn: () => getMaterialPhotoComments(photo.id),
    queryKey,
    staleTime: MATERIAL_QUERY_STALE_TIME,
  });
  const stickersQuery = useQuery({
    queryFn: getMaterialStickers,
    queryKey: materialStickersQueryKey,
  });
  const uploadMutation = useMutation({
    mutationFn: uploadMaterialSticker,
    onSuccess: (sticker) =>
      queryClient.setQueryData(materialStickersQueryKey, [sticker, ...(stickersQuery.data ?? [])]),
    onError: async (error) =>
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '表情添加失败',
      }),
  });
  const deleteStickerMutation = useMutation({
    mutationFn: deleteMaterialSticker,
    onSuccess: (_, stickerId) =>
      queryClient.setQueryData(
        materialStickersQueryKey,
        (stickersQuery.data ?? []).filter((sticker) => sticker.id !== stickerId),
      ),
    onError: async (error) =>
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '表情删除失败',
      }),
  });
  const createMutation = useMutation({
    mutationFn: (comment: { content: string } | { stickerKey: MaterialStickerKey }) =>
      addMaterialPhotoComment(photo.id, comment),
    onError: async (error) =>
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '评论发布失败',
      }),
    onSuccess: (comment) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getMaterialPhotoComments>>>(
        queryKey,
        (comments = []) => [comment, ...comments],
      );
      updateCachedMaterialPhoto(queryClient, photo.id, (item) => ({
        ...item,
        commentCount: (Number.isFinite(item.commentCount) ? item.commentCount : 0) + 1,
      }));
      setContent('');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: removeMaterialPhotoComment,
    onError: async (error) =>
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '评论删除失败',
      }),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getMaterialPhotoComments>>>(
        queryKey,
        (comments = []) => comments.filter((comment) => comment.id !== commentId),
      );
      updateCachedMaterialPhoto(queryClient, photo.id, (item) => ({
        ...item,
        commentCount: Math.max(0, (Number.isFinite(item.commentCount) ? item.commentCount : 0) - 1),
      }));
    },
  });
  const displayedCommentCount =
    commentsQuery.data?.length ?? (Number.isFinite(photo.commentCount) ? photo.commentCount : 0);

  return (
    <section aria-label="素材评论" className={styles.commentsSection}>
      <div className={styles.commentsTitle}>
        <MessageCircle aria-hidden size={17} />
        <Text fw={650} size="sm">
          评论
        </Text>
        <span>{displayedCommentCount}</span>
      </div>

      <div className={styles.commentComposer}>
        <Textarea
          aria-label="评论内容"
          autosize
          maxLength={500}
          minRows={2}
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder="写下你的想法，也可以加个表情…"
          value={content}
        />
        <div className={styles.emojiRow} aria-label="快捷表情">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              aria-label={`添加表情 ${emoji}`}
              key={emoji}
              onClick={() => setContent((value) => `${value}${emoji}`)}
              type="button"
            >
              {emoji}
            </button>
          ))}
          <Button
            disabled={!content.trim() || createMutation.isPending}
            leftSection={<Send aria-hidden size={14} />}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate({ content: content.trim() })}
            size="compact-xs"
          >
            发布
          </Button>
        </div>
      </div>

      <div className={styles.stickerPicker} aria-label="表情包">
        <Text c="dimmed" size="xs">
          表情包
        </Text>
        <div className={styles.stickerGrid}>
          <button
            aria-label="添加表情包"
            className={styles.addStickerButton}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            ＋
          </button>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) uploadMutation.mutate(file);
              event.currentTarget.value = '';
            }}
            ref={fileInputRef}
            type="file"
          />
          {stickersQuery.data?.map((sticker) => (
            <div className={styles.stickerItem} key={sticker.id}>
              <button
                aria-label="选择我的表情"
                className={styles.customStickerButton}
                onClick={() => createMutation.mutate({ stickerKey: sticker.id })}
                type="button"
              >
                <img alt="" src={sticker.url} />
              </button>
              <button
                aria-label="删除我的表情"
                className={styles.deleteStickerButton}
                onClick={() => {
                  if (window.confirm('确认从我的表情中删除吗？'))
                    deleteStickerMutation.mutate(sticker.id);
                }}
                type="button"
              >
                <Trash2 aria-hidden size={13} />
              </button>
            </div>
          ))}
          {STICKERS.map((stickerKey, index) =>
            hiddenBuiltInStickers.includes(stickerKey) ? null : (
              <div className={styles.stickerItem} key={stickerKey}>
                <button
                  aria-label={`发送表情包 ${stickerKey}`}
                  className={styles.builtInStickerButton}
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate({ stickerKey })}
                  type="button"
                >
                  <Sticker index={index} />
                </button>
                <button
                  aria-label="删除内置表情"
                  className={styles.deleteStickerButton}
                  onClick={() => {
                    if (!window.confirm('确认从表情包中隐藏吗？')) return;
                    const next = [...hiddenBuiltInStickers, stickerKey];
                    setHiddenBuiltInStickers(next);
                    localStorage.setItem(HIDDEN_STICKERS_STORAGE_KEY, JSON.stringify(next));
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden size={13} />
                </button>
              </div>
            ),
          )}
        </div>
      </div>

      {commentsQuery.isLoading ? (
        <Stack gap="xs">
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Stack>
      ) : commentsQuery.isError ? (
        <Button onClick={() => void commentsQuery.refetch()} size="compact-xs" variant="subtle">
          评论加载失败，点击重试
        </Button>
      ) : commentsQuery.data?.length ? (
        <div className={styles.commentList}>
          {commentsQuery.data.map((comment) => (
            <article className={styles.commentItem} key={comment.id}>
              <div className={styles.commentMeta}>
                <strong>{comment.author.userName}</strong>
                <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
                {comment.canDelete ? (
                  <button
                    aria-label="删除评论"
                    disabled={deleteMutation.isPending && deleteMutation.variables === comment.id}
                    onClick={() => deleteMutation.mutate(comment.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden size={14} />
                  </button>
                ) : null}
              </div>
              {comment.stickerUrl ? (
                <img
                  alt="表情包"
                  className={styles.customSentSticker}
                  src={resolveApiUrl(comment.stickerUrl)}
                />
              ) : comment.stickerKey ? (
                <div className={styles.sentSticker}>
                  <Sticker
                    index={Math.max(
                      0,
                      STICKERS.indexOf(comment.stickerKey as (typeof STICKERS)[number]),
                    )}
                  />
                </div>
              ) : (
                <Text className={styles.commentContent} size="sm">
                  {comment.content}
                </Text>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Text c="dimmed" size="xs">
          还没有评论，来聊聊这张素材吧。
        </Text>
      )}
    </section>
  );
}

function readHiddenBuiltInStickers(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(HIDDEN_STICKERS_STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function Sticker({ index }: { index: number }) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return (
    <span
      className={styles.sticker}
      style={{
        backgroundImage: `url(${stickerSheetUrl})`,
        backgroundPosition: `${column * 50}% ${row * 100}%`,
      }}
    />
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
      {isOverlay ? (
        <span
          className={styles.commentCount}
          title={`${Number.isFinite(photo.commentCount) ? photo.commentCount : 0} 条评论`}
        >
          <MessageCircle aria-hidden size={11} />
          {Number.isFinite(photo.commentCount) ? photo.commentCount : 0}
        </span>
      ) : null}
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
