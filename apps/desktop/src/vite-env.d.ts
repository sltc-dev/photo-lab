/// <reference types="vite/client" />

import type { DesktopAuthApi } from '../electron/ipc/auth.channels';
import type { DesktopLocationControl } from '../electron/ipc/location.channels';

declare global {
  interface Window {
    auth: DesktopAuthApi;
    locationControl: DesktopLocationControl;
  }
}

export {};
