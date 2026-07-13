import { queryClient } from './query-client';
import { useAuthStore } from '../stores/auth.store';

let terminationPromise: Promise<void> | null = null;

export function clearRendererSession(): void {
  // 登录状态和服务端查询缓存必须一起清空，避免下一位用户看到上一位用户的数据。
  useAuthStore.getState().clearSession();
  queryClient.clear();
}

export async function terminateSession(): Promise<void> {
  // UI 先立即退出，不等待网络；主进程随后尽力撤销并删除 Refresh Token。
  clearRendererSession();

  if (!terminationPromise) {
    // 重复点击退出时复用同一个 Promise，避免并发清理。
    terminationPromise = window.auth.logoutSession().finally(() => {
      terminationPromise = null;
    });
  }

  return terminationPromise;
}
