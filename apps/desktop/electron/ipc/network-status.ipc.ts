import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { isTrustedRendererUrl } from '../auth/trusted-renderer';
import { getNetworkStatus } from '../network-status/network-status';
import { networkStatusIpcChannels } from './network-status.channels';

export function registerNetworkStatusIpc(): void {
  ipcMain.handle(networkStatusIpcChannels.getStatus, async (event) => {
    // 确认请求是不是来做系统自己的窗口
    assertTrustedSender(event);
    return getNetworkStatus();
  });
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderFrame = event.senderFrame;
  const productionRendererUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href;

  if (
    !senderFrame ||
    senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(senderFrame.url, process.env.ELECTRON_RENDERER_URL, productionRendererUrl)
  ) {
    throw new Error('Untrusted network status IPC caller.');
  }
}
