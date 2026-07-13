/// <reference types="vite/client" />

import type { DesktopAuthApi } from '../electron/ipc/auth.channels';

declare global {
  interface Window {
    auth: DesktopAuthApi;
  }
}

export {};
