import { create } from 'zustand';

type RefreshSessionResult = Awaited<ReturnType<typeof window.auth.refreshSession>>;

type AuthStatus = 'anonymous' | 'authenticated' | 'restoring';

type AuthState = {
  accessToken: string | null;
  clearSession: () => void;
  currentUser: RefreshSessionResult['user'] | null;
  restoreSession: () => Promise<void>;
  setSession: (session: RefreshSessionResult) => void;
  status: AuthStatus;
};

let restorePromise: Promise<void> | null = null;
// 每次明确登录或退出都会递增；异步刷新只能更新它开始时所属的会话。
let sessionEpoch = 0;

export const useAuthStore = create<AuthState>((set) => ({
  // Access Token 只在内存中，刷新页面或重启应用后要用主进程的 Refresh Token 恢复。
  accessToken: null,
  clearSession: () => {
    sessionEpoch += 1;
    set({
      accessToken: null,
      currentUser: null,
      status: 'anonymous',
    });
  },
  currentUser: null,
  restoreSession: async () => {
    // React StrictMode 或多个组件同时恢复时，只发起一次 IPC 请求。
    if (restorePromise) {
      return restorePromise;
    }

    set({ status: 'restoring' });

    restorePromise = window.auth
      .refreshSession()
      .then((session) => {
        set({
          accessToken: session.accessToken,
          currentUser: session.user,
          status: 'authenticated',
        });
      })
      .catch(() => {
        set({
          accessToken: null,
          currentUser: null,
          status: 'anonymous',
        });
      })
      .finally(() => {
        restorePromise = null;
      });

    return restorePromise;
  },
  setSession: (session: RefreshSessionResult) => {
    // 手动登录/注册建立新会话，使旧请求持有的 epoch 失效。
    sessionEpoch += 1;
    set({
      accessToken: session.accessToken,
      currentUser: session.user,
      status: 'authenticated',
    });
  },
  status: 'restoring',
}));

export function selectIsAuthenticated(state: AuthState): boolean {
  return (
    state.status === 'authenticated' && state.accessToken !== null && state.currentUser !== null
  );
}

export function getAuthSessionEpoch(): number {
  return sessionEpoch;
}

export function applyRefreshedSession(
  session: RefreshSessionResult,
  expectedEpoch: number,
): boolean {
  // 刷新期间若用户已退出或重新登录，丢弃迟到的旧刷新结果。
  if (sessionEpoch !== expectedEpoch) {
    return false;
  }

  useAuthStore.setState({
    accessToken: session.accessToken,
    currentUser: session.user,
    status: 'authenticated',
  });
  return true;
}
