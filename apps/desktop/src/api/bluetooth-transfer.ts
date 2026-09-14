// 前端蓝牙的API封装
export type BluetoothTransferFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type BluetoothProjectPhotoInput = {
  fileName: string;
  mimeType: string;
  originalUrl: string;
  sizeBytes: number;
};

export type BluetoothSendResult =
  {
    canceled: false;
    file: BluetoothTransferFile;
    method: 'macos-bluetooth-file-exchange' | 'windows-fsquirt' | 'linux-bluetooth-sendto';
  };

export type BluetoothCompletedSendResult = {
  canceled: false;
  file: BluetoothTransferFile;
  method: 'macos-bluetooth-file-exchange' | 'windows-fsquirt' | 'linux-bluetooth-sendto';
};

export function sendProjectPhotoByBluetooth(
  input: BluetoothProjectPhotoInput,
): Promise<BluetoothCompletedSendResult> {
  if (!window.bluetoothTransfer) {
    throw new Error('蓝牙快传需要在 Electron 桌面端中使用；如果你正在桌面端，请重启应用。');
  }
  // 调用window上bluetoothTransfer 对象的sendProjectPhoto 方法
  return window.bluetoothTransfer.sendProjectPhoto(input);
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getBluetoothMethodLabel(method: BluetoothCompletedSendResult['method']): string {
  switch (method) {
    case 'macos-bluetooth-file-exchange':
      return 'macOS 蓝牙文件交换';
    case 'windows-fsquirt':
      return 'Windows 蓝牙文件传输';
    case 'linux-bluetooth-sendto':
      return 'Linux bluetooth-sendto';
  }
}
