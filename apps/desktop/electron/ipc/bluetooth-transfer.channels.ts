// 负责定义IPC名称和类型
export type DesktopBluetoothTransferFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type DesktopBluetoothSendResult =
  {
    canceled: false;
    file: DesktopBluetoothTransferFile;
    method: 'macos-bluetooth-file-exchange' | 'windows-fsquirt' | 'linux-bluetooth-sendto';
  };

export type DesktopBluetoothProjectPhotoInput = {
  fileName: string;
  mimeType: string;
  originalUrl: string;
  sizeBytes: number;
};

export type DesktopBluetoothSendMethod =
  | 'macos-bluetooth-file-exchange'
  | 'windows-fsquirt'
  | 'linux-bluetooth-sendto';

export type DesktopBluetoothCompletedSendResult = {
  canceled: false;
  file: DesktopBluetoothTransferFile;
  method: DesktopBluetoothSendMethod;
};

// 定义一个IPC请求名
export const bluetoothTransferIpcChannels = {
  sendProjectPhoto: 'bluetoothTransfer.sendProjectPhoto',
} as const;

export type DesktopBluetoothTransferApi = {
  sendProjectPhoto: (
    input: DesktopBluetoothProjectPhotoInput,
  ) => Promise<DesktopBluetoothCompletedSendResult>;
};
