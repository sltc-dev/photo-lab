/// <reference types="vite/client" />

import type { DesktopAuthApi } from '../electron/ipc/auth.channels';
import type { DesktopBluetoothTransferApi } from '../electron/ipc/bluetooth-transfer.channels';
import type { DesktopNetworkStatusApi } from '../electron/ipc/network-status.channels';

declare global {
  interface Window {
    auth: DesktopAuthApi;
    bluetoothTransfer: DesktopBluetoothTransferApi;
    networkStatus: DesktopNetworkStatusApi;
  }
}

export {};
