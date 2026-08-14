import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type { DesktopAuthApi } from '../electron/ipc/auth.channels';

vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}

    observe() {}

    unobserve() {}
  },
);

afterEach(() => {
  cleanup();
});

const authApi: DesktopAuthApi = {
  login: vi.fn(async () => {
    throw new Error('Login not mocked');
  }),
  logoutSession: vi.fn(async () => undefined),
  register: vi.fn(async () => {
    throw new Error('Register not mocked');
  }),
  refreshSession: vi.fn(async () => {
    throw new Error('No session');
  }),
};

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      auth: authApi,
    },
  });
} else {
  window.auth = authApi;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
}
