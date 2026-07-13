// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: {
    getPath: vi.fn(() => '/tmp/photo-lab-token-store-test'),
    isPackaged: false,
  },
  safeStorage: {
    decryptStringAsync: vi.fn(),
    encryptStringAsync: vi.fn(),
    isAsyncEncryptionAvailable: vi.fn(),
  },
}));

vi.mock('electron', () => electron);

import { TokenStore } from '../../electron/token-store';

describe('TokenStore', () => {
  beforeEach(() => {
    electron.app.isPackaged = false;
    electron.safeStorage.decryptStringAsync.mockReset();
    electron.safeStorage.encryptStringAsync.mockReset();
    electron.safeStorage.isAsyncEncryptionAvailable.mockReset();
  });

  it('uses memory only during development without opening safeStorage', async () => {
    const store = new TokenStore();

    await store.saveRefreshToken('development-refresh-token');

    await expect(store.getRefreshToken()).resolves.toBe('development-refresh-token');
    expect(electron.safeStorage.isAsyncEncryptionAvailable).not.toHaveBeenCalled();
    expect(electron.safeStorage.encryptStringAsync).not.toHaveBeenCalled();

    await store.clearRefreshToken();
    await expect(store.getRefreshToken()).resolves.toBeNull();
  });

  it('keeps the current packaged session in memory when encryption is denied', async () => {
    electron.app.isPackaged = true;
    electron.safeStorage.isAsyncEncryptionAvailable.mockResolvedValue(true);
    electron.safeStorage.encryptStringAsync.mockRejectedValue(new Error('Keychain access denied'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new TokenStore();

    await expect(store.saveRefreshToken('packaged-refresh-token')).resolves.toBeUndefined();
    await expect(store.getRefreshToken()).resolves.toBe('packaged-refresh-token');
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });
});
