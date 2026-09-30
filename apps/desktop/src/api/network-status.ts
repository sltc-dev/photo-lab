export type NetworkStatus = Awaited<ReturnType<typeof window.networkStatus.getStatus>>;

export function getNetworkStatus(): Promise<NetworkStatus> {
  if (!window.networkStatus) {
    throw new Error('网络检测需要在 Electron 桌面端中使用；如果你正在桌面端，请重启应用。');
  }

  // 调用Electron中挂到window上的能力
  return window.networkStatus.getStatus();
}

// 拿到类似数据：
//   {
  // ipAddress: '192.168.110.45', 
//   isWifi: true,
//   signalQuality: 'excellent',
//   transmitRate: 864,
//   rssi: -44
// }

export function getSignalQualityLabel(quality: NetworkStatus['signalQuality']): string {
  switch (quality) {
    case 'excellent':
      return '极好';
    case 'good':
      return '良好';
    case 'fair':
      return '一般';
    case 'weak':
      return '较弱';
    case 'unknown':
      return '未知';
  }
}
