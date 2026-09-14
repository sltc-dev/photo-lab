// 调用macOS蓝牙工具
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type BluetoothSendResult = {
  filePath: string;
  method: 'macos-bluetooth-file-exchange' | 'windows-fsquirt' | 'linux-bluetooth-sendto';
};

export async function sendFileWithSystemBluetooth(filePath: string): Promise<BluetoothSendResult> {
  await access(filePath);

  switch (platform()) {
    case 'darwin':
      // 核心命令：用 macOS 的 Bluetooth File Exchange 应用打开这个文件
      // 之后系统就会弹出蓝牙发送窗口
      await execFileAsync('open', ['-b', 'com.apple.BluetoothFileExchange', filePath]);
      return {
        filePath,
        method: 'macos-bluetooth-file-exchange',
      };
    case 'win32':
      await execFileAsync('fsquirt.exe', []);
      return {
        filePath,
        method: 'windows-fsquirt',
      };
    case 'linux':
      await execFileAsync('bluetooth-sendto', [filePath]);
      return {
        filePath,
        method: 'linux-bluetooth-sendto',
      };
    default:
      throw new Error('当前系统暂不支持蓝牙文件发送');
  }
}
