import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, safeStorage } from 'electron';

export class TokenStore {
  // Access Token 不在这里；这里专门管理不应进入渲染进程的 Refresh Token。
  private memoryRefreshToken: string | null = null;
  // 开发时不落盘，避免调试产生长期凭证；打包后才尝试安全持久化。
  private readonly persistToDisk = app.isPackaged;
  private readonly tokenPath = join(app.getPath('userData'), 'auth-refresh-token.bin');

  async saveRefreshToken(token: string): Promise<void> {
    // 无论是否能写盘，当前进程生命周期内都可以继续使用会话。
    this.memoryRefreshToken = token;

    if (!this.persistToDisk) {
      return;
    }

    try {
      // safeStorage 由操作系统密钥能力加密，比把 Token 明文写 JSON 文件更安全。
      if (!(await safeStorage.isAsyncEncryptionAvailable())) {
        throw new Error('Electron safeStorage encryption is unavailable.');
      }

      const encrypted = await safeStorage.encryptStringAsync(token);
      await fs.mkdir(dirname(this.tokenPath), { recursive: true });
      await fs.writeFile(this.tokenPath, encrypted);
    } catch (error) {
      // 持久化失败不阻断登录，只意味着应用重启后需要重新登录。
      console.warn(
        'Refresh token persistence is unavailable; continuing with an in-memory session.',
        error,
      );
    }
  }

  async getRefreshToken(): Promise<string | null> {
    // 热路径先读内存，不需要每次刷新都访问磁盘和解密。
    if (this.memoryRefreshToken) {
      return this.memoryRefreshToken;
    }

    if (!this.persistToDisk) {
      return null;
    }

    try {
      const encrypted = await fs.readFile(this.tokenPath);

      if (!(await safeStorage.isAsyncEncryptionAvailable())) {
        throw new Error('Electron safeStorage encryption is unavailable.');
      }

      const decrypted = await safeStorage.decryptStringAsync(encrypted);

      // 操作系统提示密钥方案升级时，用当前方案重新加密保存。
      if (decrypted.shouldReEncrypt) {
        await this.saveRefreshToken(decrypted.result);
      }

      this.memoryRefreshToken = decrypted.result;
      return decrypted.result;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }

      console.warn(
        'Stored refresh token is unavailable; continuing without a restored session.',
        error,
      );
      return null;
    }
  }

  async clearRefreshToken(): Promise<void> {
    // 先清内存，再尽力删除磁盘文件，保证当前进程不能继续刷新。
    this.memoryRefreshToken = null;

    if (!this.persistToDisk) {
      return;
    }

    try {
      await fs.unlink(this.tokenPath);
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async hasRefreshToken(): Promise<boolean> {
    return (await this.getRefreshToken()) !== null;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
