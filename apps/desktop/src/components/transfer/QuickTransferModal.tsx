import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, QrCode, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  getNetworkStatus,
  getSignalQualityLabel,
  type NetworkStatus,
} from '../../api/network-status';
import { photosQueryKey } from '../../api/photos';
import {
  buildQuickTransferMobileUrl,
  createQuickTransferSession,
  getQuickTransferStatus,
  type QuickTransferSession,
} from '../../api/quick-transfer';
import qrcode from '../../vendor/qrcode-generator.js';
import styles from './QuickTransferModal.module.css';

type QuickTransferModalProps = {
  onClose: () => void;
  opened: boolean;
  projectId: string;
};

export function QuickTransferModal({ onClose, opened, projectId }: QuickTransferModalProps) {
  const queryClient = useQueryClient();
  const hasAutoCreatedSessionRef = useRef(false);

  // 网络检测请求
  const networkQuery = useQuery({
    enabled: opened,
    queryFn: getNetworkStatus,
    queryKey: ['network-status'],
  });

  // 创建快传会话请求
  const {
    data: session = null,
    error: createSessionError,
    isPending: isCreatingSession,
    mutateAsync: createSession,
    reset: resetCreateSession,
  } = useMutation({
    mutationFn: () => createQuickTransferSession(projectId),
  });

  const sessionId = session?.id ?? null;
  const lastInvalidatedUploadCountRef = useRef(0);

  const statusQuery = useQuery({
    enabled: opened && Boolean(sessionId),
    queryFn: () => getQuickTransferStatus(sessionId!),
    queryKey: ['quick-transfer', sessionId, 'status'],
    refetchInterval: (query) => (query.state.error ? false : 2000),
  });
  const isSessionExpired = Boolean(statusQuery.error);

  const mobileUrl = session
    ? buildMobileUrlForDevice(buildQuickTransferMobileUrl(session), networkQuery.data?.ipAddress)
    : '';

  const handleCreateSession = useCallback(async () => {
    lastInvalidatedUploadCountRef.current = 0;
    hasAutoCreatedSessionRef.current = true;
    resetCreateSession();
    await createSession().catch(() => undefined);
  }, [createSession, resetCreateSession]);

  useEffect(() => {
    if (!opened) {
      hasAutoCreatedSessionRef.current = false;
      resetCreateSession();
      return;
    }

    if (!session && !isCreatingSession && !hasAutoCreatedSessionRef.current) {
      hasAutoCreatedSessionRef.current = true;
      void createSession().catch(() => undefined);
    }
  }, [createSession, isCreatingSession, opened, resetCreateSession, session]);

  useEffect(() => {
    const uploadedCount = statusQuery.data?.uploadedCount ?? 0;

    if (uploadedCount > lastInvalidatedUploadCountRef.current) {
      lastInvalidatedUploadCountRef.current = uploadedCount;
      void queryClient.invalidateQueries({ queryKey: photosQueryKey(projectId) });
    }
  }, [projectId, queryClient, statusQuery.data?.uploadedCount]);

  return (
    <Modal centered onClose={onClose} opened={opened} size="lg" title="面对面快传">
      <Stack gap="md">
        <NetworkPanel isLoading={networkQuery.isLoading} status={networkQuery.data ?? null} />

        {isCreatingSession ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm">正在创建快传入口...</Text>
          </Group>
        ) : createSessionError ? (
          <CreateSessionFailedPanel
            error={createSessionError}
            onCreateSession={handleCreateSession}
          />
        ) : isSessionExpired ? (
          <ExpiredSessionPanel onCreateSession={handleCreateSession} />
        ) : session ? (
          <TransferSessionPanel
            mobileUrl={mobileUrl}
            session={session}
            uploadedCount={statusQuery.data?.uploadedCount ?? 0}
          />
        ) : (
          <Button leftSection={<RefreshCw size={16} />} onClick={handleCreateSession}>
            重新创建快传入口
          </Button>
        )}
      </Stack>
    </Modal>
  );
}

function CreateSessionFailedPanel({
  error,
  onCreateSession,
}: {
  error: Error;
  onCreateSession: () => void;
}) {
  return (
    <Alert color="red" title="快传会话创建失败">
      <Stack gap="sm">
        <Text size="sm">{error.message || '请确认后端服务已经启动后重试。'}</Text>
        <Button leftSection={<RefreshCw size={16} />} onClick={onCreateSession} variant="light">
          重新创建快传入口
        </Button>
      </Stack>
    </Alert>
  );
}

function ExpiredSessionPanel({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <Alert color="yellow" title="二维码已失效">
      <Stack gap="sm">
        <Text size="sm">当前快传入口已经不可用，请重新生成后再用手机扫码。</Text>
        <Button leftSection={<RefreshCw size={16} />} onClick={onCreateSession} variant="light">
          重新生成二维码
        </Button>
      </Stack>
    </Alert>
  );
}

// 网络检测
function NetworkPanel({ isLoading, status }: { isLoading: boolean; status: NetworkStatus | null }) {
  if (isLoading) {
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm">正在检测当前网络...</Text>
      </Group>
    );
  }

  return (
    <Alert color="blue" icon={<Wifi aria-hidden size={18} />} title="当前网络">
      <Group gap="xs" mb={8}>
        <Badge variant="light">{status?.isWifi ? 'Wi-Fi 已连接' : '局域网可用'}</Badge>
        <Badge color={getSignalBadgeColor(status?.signalQuality ?? 'unknown')} variant="light">
          信号{getSignalQualityLabel(status?.signalQuality ?? 'unknown')}
        </Badge>
      </Group>
      <Text size="sm">本机地址：{status?.ipAddress ?? '未检测到局域网地址'}</Text>
      {status?.transmitRate ? (
        <Text c="dimmed" size="sm">
          当前速度：{status.transmitRate} Mbps
        </Text>
      ) : null}
      {status?.rssi !== null && status?.rssi !== undefined ? (
        <Text c="dimmed" size="xs">
          信号值：{status.rssi} dBm
        </Text>
      ) : null}
    </Alert>
  );
}

function getSignalBadgeColor(quality: NetworkStatus['signalQuality']) {
  switch (quality) {
    case 'excellent':
    case 'good':
      return 'green';
    case 'fair':
      return 'yellow';
    case 'weak':
      return 'orange';
    case 'unknown':
      return 'gray';
  }
}

function TransferSessionPanel({
  mobileUrl,
  session,
  uploadedCount,
}: {
  mobileUrl: string;
  session: QuickTransferSession;
  uploadedCount: number;
}) {
  return (
    <Stack gap="sm">
      <TransferStatusPanel uploadedCount={uploadedCount} />
      <Group gap="sm">
        <Smartphone aria-hidden size={18} />
        <Text fw={700}>用手机打开下面地址上传图片</Text>
      </Group>
      <CopyButton value={mobileUrl}>
        {({ copied, copy }) => (
          <div className={styles.urlRow}>
            <Text className={styles.urlText}>{mobileUrl}</Text>
            <Tooltip label={copied ? '已复制' : '复制链接'} withArrow>
              <ActionIcon aria-label="复制快传链接" onClick={copy} variant="subtle">
                <Copy aria-hidden size={16} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
      </CopyButton>
      <QrCodePanel value={mobileUrl} />
      <Text c="dimmed" size="sm">
        手机需要连接同一个 Wi-Fi。会话将在 <Code>{formatTime(session.expiresAt)}</Code> 过期。
      </Text>
    </Stack>
  );
}

function TransferStatusPanel({ uploadedCount }: { uploadedCount: number }) {
  if (uploadedCount > 0) {
    return (
      <Alert color="green" icon={<CheckCircle2 aria-hidden size={18} />} title="上传成功">
        已接收 {uploadedCount} 张图片。二维码仍可继续使用，过期前可以继续上传。
      </Alert>
    );
  }

  return (
    <Alert color="blue" icon={<QrCode aria-hidden size={18} />} title="等待手机上传">
      手机上传成功后，这里会自动显示接收结果。
    </Alert>
  );
}

// 二维码生成
function QrCodePanel({ value }: { value: string }) {
  const svgMarkup = useMemo(() => {
    if (!value) {
      return '';
    }

    // 根据URL生成二维码
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();
    return code.createSvgTag(4, 3);
  }, [value]);

  return (
    <Stack align="center" gap={8}>
      <Group gap={8}>
        <QrCode aria-hidden size={16} />
        <Text fw={650} size="sm">
          手机扫码上传
        </Text>
      </Group>
      <div
        aria-label="面对面快传二维码"
        className={styles.qrShell}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
        role="img"
      />
    </Stack>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildMobileUrlForDevice(url: string, ipAddress: string | null | undefined): string {
  if (!ipAddress) {
    return url;
  }

  const mobileUrl = new URL(url);
  mobileUrl.hostname = ipAddress;
  return mobileUrl.toString();
}
