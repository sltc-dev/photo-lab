import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app } from 'electron';
import { registerAuthIpc } from './ipc/auth.ipc';
import { TokenStore } from './token-store';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

// 认证 HTTP 请求发生在 Electron 主进程，因此主进程也要拿到与渲染进程相同的 API 地址。
process.env.VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

/** 创建承载 React 页面且关闭高风险能力的 Electron 窗口。 */
function createWindow(): void {
  const rendererEntryPath = join(__dirname, '../renderer/index.html');
  const rendererEntryUrl = pathToFileURL(rendererEntryPath).href;
  const rendererUrl = import.meta.env.DEV ? process.env.ELECTRON_RENDERER_URL : undefined;
  const mainWindow = new BrowserWindow({
    backgroundColor: '#f7f8fa',
    height: 760,
    minHeight: 640,
    minWidth: 960,
    show: false,
    title: 'Photo Lab',
    webPreferences: {
      // React 渲染进程与 Node/Electron 能力隔离，只能通过 preload 暴露的窄接口通信。
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: true,
    },
    width: 1180,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    // 阻止页面被导航到非项目来源，避免外部页面获得 window.auth 能力。
    if (!isTrustedNavigation(targetUrl, rendererUrl, rendererEntryUrl)) {
      event.preventDefault();
    }
  });

  // 当前产品不需要弹出新窗口，默认全部拒绝。
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(rendererEntryPath);
  }
}

function isTrustedNavigation(
  targetUrl: string,
  rendererUrl: string | undefined,
  rendererEntryUrl: string,
): boolean {
  try {
    if (rendererUrl) {
      return new URL(targetUrl).origin === new URL(rendererUrl).origin;
    }

    return new URL(targetUrl).href === rendererEntryUrl;
  } catch {
    return false;
  }
}

void app.whenReady().then(() => {
  // TokenStore 和认证 IPC 属于主进程单例，同一应用窗口共享一份会话。
  const tokenStore = new TokenStore();
  registerAuthIpc(tokenStore);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
