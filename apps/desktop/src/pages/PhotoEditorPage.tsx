import { Alert, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Check, Save } from 'lucide-react';
import FilerobotImageEditor, {
  TABS,
  TOOLS,
  type FilerobotImageEditorConfig,
  type getCurrentImgDataFunction,
} from 'react-filerobot-image-editor';
import { useEffect, useRef, useState, type RefObject, type WheelEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/http';
import { projectQueryKey, projectsQueryKey } from '../api/projects';
import {
  getPhotoEditorSource,
  photoEditorSourceQueryKey,
  photosQueryKey,
  saveProjectPhotoEdit,
} from '../api/photos';
import styles from '../styles/pages/PhotoEditorPage.module.css';

const editorTranslations = {
  addImage: '添加图片',
  addTextWatermark: '添加文字水印',
  addWatermark: '添加水印',
  addWatermarkAsText: '文字水印',
  adjustTab: '调整',
  annotateTabLabel: '标注',
  apply: '应用',
  cancel: '取消',
  confirm: '确认',
  cropTool: '裁剪',
  custom: '自由',
  imageTool: '图片',
  original: '原始比例',
  redoTitle: '重做',
  resetOperations: '重置全部操作',
  rotateTool: '旋转',
  textTool: '文字',
  undoTitle: '撤销',
  uploadImage: '上传图片',
  uploadWatermark: '上传图片水印',
  watermarkTab: '水印',
};

export function PhotoEditorPage() {
  const { photoId, projectId } = useParams<{ photoId: string; projectId: string }>();

  if (!photoId || !projectId) {
    return <Navigate replace to="/" />;
  }

  return <PhotoEditorContent photoId={photoId} projectId={projectId} />;
}

function PhotoEditorContent({ photoId, projectId }: { photoId: string; projectId: string }) {
  const editorDataRef = useRef<getCurrentImgDataFunction | undefined>(undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sourceQuery = useQuery({
    queryFn: () => getPhotoEditorSource(projectId, photoId),
    queryKey: photoEditorSourceQueryKey(projectId, photoId),
  });
  const saveMutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const getCurrentImageData = editorDataRef.current;

      if (!getCurrentImageData) {
        throw new Error('图片编辑器尚未准备好');
      }

      const { designState, imageData } = getCurrentImageData({
        extension: 'webp',
        name: `${photoId}.edited`,
        quality: 0.9,
      });
      const file = await canvasToFile(imageData.imageCanvas, imageData.fullName);

      await saveProjectPhotoEdit({
        editState: designState,
        file,
        finalize,
        photoId,
        projectId,
      });
    },
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: await getApiErrorMessage(error),
        title: '图片保存失败',
      });
    },
    onSuccess: async (_, finalize) => {
      if (finalize) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: photosQueryKey(projectId) }),
          queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) }),
          queryClient.invalidateQueries({ exact: true, queryKey: projectsQueryKey }),
        ]);
        queryClient.removeQueries({
          queryKey: photoEditorSourceQueryKey(projectId, photoId),
        });
      }
      notifications.show({
        color: 'green',
        message: finalize ? '已保留原图并新增编辑后的图片' : '编辑草稿已保存',
        title: '保存成功',
      });

      if (finalize) {
        navigate(`/projects/${projectId}`);
      }
    },
  });

  if (sourceQuery.isLoading) {
    return (
      <Center className={styles.loadingState}>
        <Loader aria-label="正在加载图片编辑器" />
      </Center>
    );
  }

  if (sourceQuery.isError || !sourceQuery.data) {
    return (
      <Alert color="red" icon={<AlertCircle aria-hidden size={20} />} title="无法加载待编辑图片">
        <Button component={Link} mt="sm" to={`/projects/${projectId}`} variant="light">
          返回项目
        </Button>
      </Alert>
    );
  }

  return (
    <Stack className={styles.page} gap="md">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Button
            component={Link}
            leftSection={<ArrowLeft aria-hidden size={16} />}
            px={0}
            to={`/projects/${projectId}`}
            variant="subtle"
          >
            返回项目
          </Button>
          <Title order={2}>编辑照片</Title>
          <Text c="dimmed" size="sm">
            原图始终作为编辑底图；已保存的编辑状态会自动恢复
          </Text>
        </div>
        <Group>
          <Button
            disabled={saveMutation.isPending}
            leftSection={<Save aria-hidden size={16} />}
            loading={saveMutation.isPending && saveMutation.variables === false}
            onClick={() => saveMutation.mutate(false)}
            variant="light"
          >
            保存草稿
          </Button>
          <Button
            disabled={saveMutation.isPending}
            leftSection={<Check aria-hidden size={16} />}
            loading={saveMutation.isPending && saveMutation.variables === true}
            onClick={() => saveMutation.mutate(true)}
          >
            完成编辑
          </Button>
        </Group>
      </Group>
      <div className={styles.editor} onWheelCapture={handleEditorWheelCapture}>
        <OpenSourceImageEditor
          editState={sourceQuery.data.editState}
          editorDataRef={editorDataRef}
          source={sourceQuery.data.blob}
        />
      </div>
    </Stack>
  );
}

function handleEditorWheelCapture(event: WheelEvent<HTMLDivElement>) {
  const target = event.target;

  if (
    target instanceof Element &&
    target.closest('.FIE_canvas-node') &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    event.stopPropagation();
  }
}

function OpenSourceImageEditor({
  editState,
  editorDataRef,
  source,
}: {
  editState: Record<string, unknown> | null;
  editorDataRef: RefObject<getCurrentImgDataFunction | undefined>;
  source: Blob;
}) {
  const [sourceUrl, setSourceUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(source);
    setSourceUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [source]);

  if (!sourceUrl) {
    return (
      <Center h="100%">
        <Loader aria-label="正在准备图片编辑器" />
      </Center>
    );
  }

  return (
    <FilerobotImageEditor
      defaultSavedImageQuality={0.9}
      defaultSavedImageType="webp"
      defaultTabId={TABS.ADJUST}
      defaultToolId={TOOLS.CROP}
      getCurrentImgDataFnRef={editorDataRef}
      loadableDesignState={editState as FilerobotImageEditorConfig['loadableDesignState']}
      observePluginContainerSize
      previewPixelRatio={1}
      removeSaveButton
      savingPixelRatio={1}
      source={sourceUrl}
      tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.WATERMARK]}
      translations={editorTranslations}
      useBackendTranslations={false}
    />
  );
}

function canvasToFile(canvas: HTMLCanvasElement | undefined, fileName?: string): Promise<File> {
  if (!canvas) {
    throw new Error('图片导出失败');
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片导出失败'));
          return;
        }

        resolve(
          new File([blob], fileName ?? 'edited.webp', {
            type: 'image/webp',
          }),
        );
      },
      'image/webp',
      0.9,
    );
  });
}
