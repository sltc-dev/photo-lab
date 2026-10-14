import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../../config/env';
import { LocationAddressService } from '../location-address.service';

function service(key = 'test-key') {
  return new LocationAddressService({ get: () => key } as unknown as ConfigService<AppEnv, true>);
}

const location = { latitude: 30.611906, longitude: 104.142504 };

describe('AMap location addresses', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('converts GPS coordinates before resolving an address', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: '1', locations: '104.145000,30.610000' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: '1', regeocode: { formatted_address: 'Example address' } }),
      });
    vi.stubGlobal('fetch', fetcher);

    await expect(service().resolveAddressFromCoordinates(location)).resolves.toEqual({
      label: 'Example address',
    });
    const conversion = fetcher.mock.calls[0]![0] as URL;
    const address = fetcher.mock.calls[1]![0] as URL;
    expect(conversion.origin).toBe('https://restapi.amap.com');
    expect(conversion.searchParams.get('coordsys')).toBe('gps');
    expect(conversion.searchParams.get('locations')).toBe('104.142504,30.611906');
    expect(address.searchParams.get('location')).toBe('104.145000,30.610000');
    expect(address.searchParams.get('extensions')).toBe('base');
  });

  it('rejects provider failures even with HTTP 200 and does not leak the key', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: '0', info: 'INVALID_USER_KEY' }),
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(service().resolveAddressFromCoordinates(location)).rejects.toThrow(
      '暂时无法解析地址，请稍后重试。',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not call the provider when the key is missing', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(service('').resolveAddressFromCoordinates(location)).rejects.toThrow(
      '地址服务尚未配置',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
