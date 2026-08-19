import { ActionIcon, Indicator } from '@mantine/core';
import { notifications as toast } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotificationDetail,
  getNotifications,
  notificationListQueryKey,
  notificationsQueryKey,
  subscribeNotificationStream,
} from '../../api/notifications';
import styles from '../../styles/components/notifications/NotificationCenter.module.css';

export function NotificationCenter() {
  const notificationsQuery = useQuery({
    queryFn: () => getNotifications(),
    queryKey: notificationListQueryKey(),
    refetchInterval: 60_000,
  });

  useNotificationStream();

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <Indicator
      color="red"
      disabled={unreadCount === 0}
      inline
      label={unreadCount > 99 ? '99+' : unreadCount}
      offset={5}
      size={17}
    >
      <ActionIcon
        aria-label={unreadCount > 0 ? `查看通知，${unreadCount} 条未读` : '查看通知'}
        className={styles.bellButton}
        component={Link}
        radius="sm"
        size={44}
        to="/notifications"
        variant="subtle"
      >
        <Bell aria-hidden size={19} />
      </ActionIcon>
    </Indicator>
  );
}

function useNotificationStream(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    //AbortController 用来主动终止 SSE 请求，
    // controller.signal  取消信号，负责告诉任务“有没有被取消”
    //controller.abort() 真正发出取消命令
    const controller = new AbortController();

    //定义收到通知后的处理函数
    const handlePublishedNotification = async (notificationId: string) => {
      try {
        await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        const detail = await getNotificationDetail(notificationId);
        toast.show({
          autoClose: 6000,
          message: detail.summary,
          title: detail.title,
        });
      } catch {
        return;
      }
    };

    const connect = async () => {
      //只要没有主动取消，就一直运行
      while (!controller.signal.aborted) {
        try {
          //建立 SSE 连接
          await subscribeNotificationStream(
            (event) => void handlePublishedNotification(event.notificationId),
            controller.signal,
          );
        } catch {
          // 断线后由下面的固定退避重连；轮询仍会保证列表最终一致。
        }

        await waitForReconnect(controller.signal, 3_000);
      }
    };

    void connect();
    //组件卸载并执行
    return () => controller.abort();
  }, [queryClient]);
}

function waitForReconnect(signal: AbortSignal, delay: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
