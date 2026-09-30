import { execFile } from 'node:child_process';
import { networkInterfaces, platform } from 'node:os';
import { promisify } from 'node:util';
import type { DesktopNetworkStatus } from '../ipc/network-status.channels';

const execFileAsync = promisify(execFile);

export async function getNetworkStatus(): Promise<DesktopNetworkStatus> {
  // 拿到本机局域网IP
  const ipAddress = getLocalIpAddress();

  if (platform() !== 'darwin') {
    return {
      channel: null,
      ipAddress,
      isWifi: false,
      noise: null,
      phyMode: null,
      rssi: null,
      signalQuality: 'unknown',
      ssid: null,
      transmitRate: null,
    };
  }


  // 获取wifi对应的设备名
  const wifiDevice = await getMacWifiDevice().catch(() => null);
  // 获取当前连接的wifi名称
  const ssid = wifiDevice ? await getMacWifiSsid(wifiDevice).catch(() => null) : null;
  
  const airportInfo = await readMacWifiInfo().catch(() => null);
  const systemProfilerInfo = await readMacSystemProfilerWifiInfo().catch(() => null);
  const signalNoise = systemProfilerInfo ? readSignalNoise(systemProfilerInfo) : null;
  const rssi = airportInfo
    ? readNumberField(airportInfo, 'agrCtlRSSI')
    : (signalNoise?.rssi ?? null);

  return {
    channel: systemProfilerInfo ? readStringField(systemProfilerInfo, 'Channel') : null,
    ipAddress,
    isWifi: Boolean(ssid || airportInfo?.includes('AirPort: On') || systemProfilerInfo?.includes('Status: Connected')),
    noise: signalNoise?.noise ?? null,
    phyMode: systemProfilerInfo ? readStringField(systemProfilerInfo, 'PHY Mode') : null,
    rssi,
    signalQuality: getSignalQuality(rssi),
    ssid: ssid ?? (airportInfo ? readStringField(airportInfo, 'SSID') : null),
    transmitRate: systemProfilerInfo ? readNumberField(systemProfilerInfo, 'Transmit Rate') : null,
  };
}

function getLocalIpAddress(): string | null {
  // node自带方法，会列出电脑上的网络网卡，比如wifi、以太网等
  const interfaces = networkInterfaces();

  // 找第一个符合条件的
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

async function readMacWifiInfo(): Promise<string> {
  const airportPath =
    '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
  const { stdout } = await execFileAsync(airportPath, ['-I']);
  return stdout;
}

async function readMacSystemProfilerWifiInfo(): Promise<string> {
  const { stdout } = await execFileAsync('/usr/sbin/system_profiler', ['SPAirPortDataType']);
  return stdout;
}

// 执行macOS命令来获取WIFI对应的设备名
async function getMacWifiDevice(): Promise<string | null> {
  const { stdout } = await execFileAsync('/usr/sbin/networksetup', ['-listallhardwareports']);
  const match = stdout.match(/Hardware Port: Wi-Fi[\s\S]*?Device: (\S+)/);
  return match?.[1] ?? null;
}

async function getMacWifiSsid(device: string): Promise<string | null> {
  const { stdout } = await execFileAsync('/usr/sbin/networksetup', ['-getairportnetwork', device]);
  const match = stdout.match(/Current Wi-Fi Network:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

function readStringField(output: string, field: string): string | null {
  const match = output.match(new RegExp(`^\\s*${field}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() || null;
}

function readNumberField(output: string, field: string): number | null {
  const value = readStringField(output, field);
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readSignalNoise(output: string): { noise: number | null; rssi: number } | null {
  const match = output.match(/Signal \/ Noise:\s*(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/);

  if (!match) {
    return null;
  }

  return {
    noise: Number(match[2]),
    rssi: Number(match[1]),
  };
}

function getSignalQuality(rssi: number | null): DesktopNetworkStatus['signalQuality'] {
  if (rssi === null) {
    return 'unknown';
  }

  if (rssi >= -50) {
    return 'excellent';
  }

  if (rssi >= -60) {
    return 'good';
  }

  if (rssi >= -70) {
    return 'fair';
  }

  return 'weak';
}
