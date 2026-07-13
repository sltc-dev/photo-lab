interface RefreshTokenStore {
  clearRefreshToken(): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  saveRefreshToken(token: string): Promise<void>;
}

interface SessionWithRefreshToken {
  refreshToken: string;
}

export class AuthSessionCoordinator<TSession extends SessionWithRefreshToken> {
  // 所有会修改 Refresh Token 的操作串行执行，避免登录、刷新、退出互相覆盖。
  private operationTail: Promise<void> = Promise.resolve();
  // 多个请求同时发现 Access Token 过期时，共用同一次刷新请求。
  private refreshPromise: Promise<TSession> | null = null;

  constructor(private readonly tokenStore: RefreshTokenStore) {}

  createSession(request: () => Promise<TSession>): Promise<TSession> {
    return this.runExclusive(async () => {
      const session = await request();
      // 先安全保存 Refresh Token，再把会话结果交给调用者。
      await this.tokenStore.saveRefreshToken(session.refreshToken);
      return session;
    });
  }

  refreshSession(
    request: (refreshToken: string) => Promise<TSession>,
    shouldClearToken: (error: unknown) => boolean,
  ): Promise<TSession> {
    // 已有刷新正在进行时直接复用，防止同一个单次 Token 被并发提交两次。
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshPromise = this.runExclusive(async () => {
      const refreshToken = await this.tokenStore.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token is stored.');
      }

      let session: TSession;

      try {
        session = await request(refreshToken);
      } catch (error) {
        // 后端明确判定 Token 无效才清除；临时网络错误保留会话以便稍后重试。
        if (shouldClearToken(error)) {
          await this.tokenStore.clearRefreshToken();
        }

        throw error;
      }

      await this.tokenStore.saveRefreshToken(session.refreshToken);
      return session;
    });

    this.refreshPromise = refreshPromise;
    void refreshPromise.then(
      () => this.clearRefreshPromise(refreshPromise),
      () => this.clearRefreshPromise(refreshPromise),
    );

    return refreshPromise;
  }

  logoutSession(request: (refreshToken: string) => Promise<void>): Promise<void> {
    return this.runExclusive(async () => {
      const refreshToken = await this.tokenStore.getRefreshToken();

      if (refreshToken) {
        // 后端退出是尽力而为；即使请求失败，本机凭证仍必须清掉。
        await request(refreshToken).catch(() => undefined);
      }

      await this.tokenStore.clearRefreshToken();
    });
  }

  private clearRefreshPromise(refreshPromise: Promise<TSession>): void {
    if (this.refreshPromise === refreshPromise) {
      this.refreshPromise = null;
    }
  }

  private runExclusive<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    // operationTail 像一条队列：上一个操作结束后，下一个才开始。
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
