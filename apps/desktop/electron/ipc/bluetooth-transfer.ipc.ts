// React页面发送来的跨进程请求，在这里接收和处理
// 这个文件负责处理蓝牙IPC请求
import { createWriteStream } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { isTrustedRendererUrl } from '../auth/trusted-renderer';
import { sendFileWithSystemBluetooth } from '../bluetooth-transfer/system-bluetooth-sender';
import {
  bluetoothTransferIpcChannels,
  type DesktopBluetoothCompletedSendResult,
  type DesktopBluetoothProjectPhotoInput,
} from './bluetooth-transfer.channels';

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

export function registerBluetoothTransferIpc(): void {
  // 注册IPC handler
  // 如果收到 bluetoothTransfer.sendProjectPhoto 这个请求，就执行这里的逻辑
  ipcMain.handle(
    bluetoothTransferIpcChannels.sendProjectPhoto,
    async (
      event,
      input: unknown,
    ): Promise<DesktopBluetoothCompletedSendResult> => {
      // 检查请求来源，确认这个请求来自应用自己的窗口
      assertTrustedSender(event);

      // 进行输入校验
      const photo = projectPhotoInputSchema.parse(input);
      // 将图库图片下载到临时目录中
      const tempFilePath = await downloadProjectPhotoToTempFile(photo);
      // 调用系统蓝牙发送
      const sendResult = await sendFileWithSystemBluetooth(tempFilePath);

      // 最后将结果返回给前端
      return {
        canceled: false,
        file: {
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
        },
        method: sendResult.method,
      };
    },
  );
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderFrame = event.senderFrame;
  const productionRendererUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href;

  if (
    !senderFrame ||
    senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(senderFrame.url, process.env.ELECTRON_RENDERER_URL, productionRendererUrl)
  ) {
    throw new Error('Untrusted bluetooth transfer IPC caller.');
  }
}

async function downloadProjectPhotoToTempFile(
  photo: DesktopBluetoothProjectPhotoInput,
): Promise<string> {
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const photoUrl = new URL(photo.originalUrl);

  if (photoUrl.origin !== new URL(apiBaseUrl).origin) {
    throw new Error('照片地址不属于当前 API 服务');
  }

  const response = await fetch(photoUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error('照片下载失败');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength !== photo.sizeBytes) {
    throw new Error('照片下载不完整');
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'photo-lab-bluetooth-'));
  const tempFilePath = join(tempDir, sanitizeFileName(photo.fileName));

  await writeBufferToFile(tempFilePath, buffer);

  return tempFilePath;
}

function writeBufferToFile(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, { mode: 0o600 });
    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(buffer);
  });
}

function sanitizeFileName(fileName: string): string {
  const safeBaseName = basename(fileName).replace(/[/:\\\0]/g, '').trim();
  return safeBaseName || 'photo.jpg';
}

const projectPhotoInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  originalUrl: z.string().url(),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});
