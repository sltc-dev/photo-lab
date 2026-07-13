import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { isInvalidRefreshTokenError, postJson } from '../auth/auth-api-client';
import { loginInputSchema, registerInputSchema } from '../auth/auth-input-schemas';
import { AuthSessionCoordinator } from '../auth/auth-session-coordinator';
import { isTrustedRendererUrl } from '../auth/trusted-renderer';
import {
  authIpcChannels,
  type DesktopAuthSession,
  type DesktopLoginInput,
  type DesktopRegisterInput,
} from './auth.channels';
import type { TokenStore } from '../token-store';

type AuthApiSession = DesktopAuthSession & {
  refreshToken: string;
};

export function registerAuthIpc(tokenStore: TokenStore): void {
  // Coordinator 统一处理 Token 保存、轮换和并发，不让每个 IPC handler 各自管理状态。
  const sessionCoordinator = new AuthSessionCoordinator<AuthApiSession>(tokenStore);

  ipcMain.handle(
    authIpcChannels.login,
    async (event, input: unknown): Promise<DesktopAuthSession> => {
      // 先检查调用者页面，再校验跨进程输入，最后才请求后端。
      assertTrustedSender(event);
      return createSession(sessionCoordinator, '/auth/login', loginInputSchema.parse(input));
    },
  );

  ipcMain.handle(
    authIpcChannels.register,
    async (event, input: unknown): Promise<DesktopAuthSession> => {
      assertTrustedSender(event);
      return createSession(sessionCoordinator, '/auth/register', registerInputSchema.parse(input));
    },
  );

  ipcMain.handle(authIpcChannels.refreshSession, async (event): Promise<DesktopAuthSession> => {
    assertTrustedSender(event);
    return refreshSession(sessionCoordinator);
  });

  ipcMain.handle(authIpcChannels.logoutSession, async (event): Promise<void> => {
    assertTrustedSender(event);
    await logoutSession(sessionCoordinator);
  });
}

async function createSession(
  sessionCoordinator: AuthSessionCoordinator<AuthApiSession>,
  path: '/auth/login' | '/auth/register',
  body: DesktopLoginInput | DesktopRegisterInput,
): Promise<DesktopAuthSession> {
  const session = await sessionCoordinator.createSession(() =>
    postJson<AuthApiSession>(path, body, authSessionSchema),
  );

  // 有意删掉 refreshToken：React 渲染进程只能拿到短期 Access Token。
  return {
    accessToken: session.accessToken,
    user: session.user,
  };
}

async function refreshSession(
  sessionCoordinator: AuthSessionCoordinator<AuthApiSession>,
): Promise<DesktopAuthSession> {
  // 原始 Refresh Token 只在主进程内读出并提交给后端。
  const session = await sessionCoordinator.refreshSession(
    (refreshToken) =>
      postJson<AuthApiSession>('/auth/refresh', { refreshToken }, authSessionSchema),
    isInvalidRefreshTokenError,
  );

  return {
    accessToken: session.accessToken,
    user: session.user,
  };
}

async function logoutSession(
  sessionCoordinator: AuthSessionCoordinator<AuthApiSession>,
): Promise<void> {
  await sessionCoordinator.logoutSession(async (refreshToken) => {
    await postJson('/auth/logout', { refreshToken }, logoutResultSchema);
  });
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderFrame = event.senderFrame;
  const productionRendererUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href;

  if (
    !senderFrame ||
    senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(senderFrame.url, process.env.ELECTRON_RENDERER_URL, productionRendererUrl)
  ) {
    // 防止子 frame 或被导航到外部来源的页面调用高权限认证 IPC。
    throw new Error('Untrusted auth IPC caller.');
  }
}

const userSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  updatedAt: z.string(),
  username: z.string(),
});

const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(32),
  user: userSchema,
});

const logoutResultSchema = z.object({
  ok: z.boolean(),
});
