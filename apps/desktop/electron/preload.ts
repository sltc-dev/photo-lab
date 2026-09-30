// React 页面和 Electron 主进程之间的安全桥梁
import { contextBridge, ipcRenderer } from 'electron';
import { authIpcChannels, type DesktopAuthApi } from './ipc/auth.channels';
import {
  bluetoothTransferIpcChannels,
  type DesktopBluetoothTransferApi,
} from './ipc/bluetooth-transfer.channels';
import {
  networkStatusIpcChannels,
  type DesktopNetworkStatusApi,
} from './ipc/network-status.channels';

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

// 创建一个对象将ipc Renderer这个对象进行包装
// 为了安全问题，不能直接暴露
const bluetoothTransferApi: DesktopBluetoothTransferApi = {
  sendProjectPhoto: (input) =>
    // 向主进程发送一个ipc请求，请求名称叫bluetoothTransfer.sendProjectPhoto
    ipcRenderer.invoke(
      bluetoothTransferIpcChannels.sendProjectPhoto,
      input,
    ) as ReturnType<DesktopBluetoothTransferApi['sendProjectPhoto']>,
};

const networkStatusApi: DesktopNetworkStatusApi = {
  getStatus: () =>
    // 向主进程发送一个ipc请求
    ipcRenderer.invoke(
      networkStatusIpcChannels.getStatus,
    ) as ReturnType<DesktopNetworkStatusApi['getStatus']>,
};

// 如果 preload 想给 React 提供一个安全能力
// 就需要把一个经过包装的安全对象放到 window 上
contextBridge.exposeInMainWorld('auth', authApi);
contextBridge.exposeInMainWorld('bluetoothTransfer', bluetoothTransferApi);
contextBridge.exposeInMainWorld('networkStatus', networkStatusApi);
