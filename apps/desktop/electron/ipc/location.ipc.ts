import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { isTrustedRendererUrl } from '../auth/trusted-renderer';
import { ensureSystemLocationAccess, isSystemLocationAuthorized } from '../system-location';
import { locationIpcChannels } from './location.channels';

export function registerLocationPermissions(
  webContents: WebContents,
  developmentUrl: string | undefined,
  productionUrl: string,
): void {
  let enabled = false;
  const trusted = (url: string) => isTrustedRendererUrl(url, developmentUrl, productionUrl);
  const assertTrustedSender = (event: IpcMainInvokeEvent) => {
    if (
      event.sender !== webContents ||
      event.senderFrame !== webContents.mainFrame ||
      !event.senderFrame ||
      !trusted(event.senderFrame.url)
    )
      throw new Error('Untrusted location request.');
  };

  const removeHandlers = () => {
    ipcMain.removeHandler(locationIpcChannels.requestAccess);
    ipcMain.removeHandler(locationIpcChannels.revokeAccess);
  };
  removeHandlers();

  // 页面在调用 getCurrentPosition 之前先走这里：需要时弹出系统授权框，等用户选择后返回结果。
  ipcMain.handle(locationIpcChannels.requestAccess, (event) => {
    assertTrustedSender(event);
    enabled = true;
    return ensureSystemLocationAccess();
  });
  ipcMain.handle(locationIpcChannels.revokeAccess, (event) => {
    assertTrustedSender(event);
    enabled = false;
  });

  // Chromium 处理 getCurrentPosition 时同步询问这里；授权已在 requestAccess 中完成，这里只做检查。
  const allowed = (
    sender: WebContents | null,
    permission: string,
    details: { isMainFrame?: boolean; requestingUrl?: string },
  ) =>
    enabled &&
    sender === webContents &&
    permission === 'geolocation' &&
    details.isMainFrame === true &&
    trusted(details.requestingUrl ?? '') &&
    trusted(webContents.getURL()) &&
    isSystemLocationAuthorized();

  webContents.session.setPermissionCheckHandler((sender, permission, _origin, details) =>
    allowed(sender, permission, details),
  );
  webContents.session.setPermissionRequestHandler((sender, permission, callback, details) =>
    callback(allowed(sender, permission, details)),
  );
  webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) enabled = false;
  });
  webContents.on('destroyed', () => {
    enabled = false;
    removeHandlers();
  });
}
