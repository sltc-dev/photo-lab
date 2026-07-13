import { contextBridge, ipcRenderer } from 'electron';
import { authIpcChannels, type DesktopAuthApi } from './ipc/auth.channels';

const authApi: DesktopAuthApi = {
  // invoke 是“请求-响应”式 IPC：React await 后会收到主进程的结果或异常。
  login: (input) =>
    ipcRenderer.invoke(authIpcChannels.login, input) as ReturnType<DesktopAuthApi['login']>,
  logoutSession: () => ipcRenderer.invoke(authIpcChannels.logoutSession) as Promise<void>,
  register: (input) =>
    ipcRenderer.invoke(authIpcChannels.register, input) as ReturnType<DesktopAuthApi['register']>,
  refreshSession: () =>
    ipcRenderer.invoke(authIpcChannels.refreshSession) as ReturnType<
      DesktopAuthApi['refreshSession']
    >,
};

// 渲染进程只得到四个认证方法，不会拿到原始 ipcRenderer 或 Node.js 能力。
contextBridge.exposeInMainWorld('auth', authApi);
