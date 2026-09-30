export const networkStatusIpcChannels = {
  getStatus: 'networkStatus.getStatus',
} as const;

export type DesktopNetworkStatus = {
  channel: string | null;
  ipAddress: string | null;
  isWifi: boolean;
  noise: number | null;
  phyMode: string | null;
  rssi: number | null;
  signalQuality: 'excellent' | 'good' | 'fair' | 'weak' | 'unknown';
  ssid: string | null;
  transmitRate: number | null;
};

export type DesktopNetworkStatusApi = {
  getStatus: () => Promise<DesktopNetworkStatus>;
};
