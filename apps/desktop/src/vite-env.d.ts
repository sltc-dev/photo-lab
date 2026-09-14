/// <reference types="vite/client" />

import type { DesktopAuthApi } from '../electron/ipc/auth.channels';
import type { DesktopBluetoothTransferApi } from '../electron/ipc/bluetooth-transfer.channels';

declare global {
  interface Window {
    auth: DesktopAuthApi;
    bluetoothTransfer: DesktopBluetoothTransferApi;
  }
}

export {};
