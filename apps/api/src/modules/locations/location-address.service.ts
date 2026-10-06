import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { AppEnv } from '../../config/env';
import type { ResolveLocationAddressDto } from './dto/location.dto';

const conversionSchema = z.object({ status: z.literal('1'), locations: z.string().min(1) });
const addressSchema = z.object({
  status: z.literal('1'),
  regeocode: z.object({ formatted_address: z.string().trim().min(1) }),
});

@Injectable()
export class LocationAddressService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>) {}

  async resolveAddressFromCoordinates(
    location: ResolveLocationAddressDto,
  ): Promise<{ label: string }> {
    const key = this.config.get('AMAP_WEB_SERVICE_KEY', { infer: true });
    if (!key) {
      throw new ServiceUnavailableException('地址服务尚未配置，请联系管理员。');
    }

    const signal = AbortSignal.timeout(10_000);
    try {
      const conversion = conversionSchema.parse(
        await this.request('/v3/assistant/coordinate/convert', key, signal, {
          locations: `${location.longitude.toFixed(6)},${location.latitude.toFixed(6)}`,
          coordsys: 'gps',
        }),
      );
      const result = addressSchema.parse(
        await this.request('/v3/geocode/regeo', key, signal, {
          location: conversion.locations,
          extensions: 'base',
        }),
      );

      return { label: result.regeocode.formatted_address };
    } catch {
      throw new ServiceUnavailableException('暂时无法解析地址，请稍后重试。');
    }
  }

  private async request(
    path: string,
    key: string,
    signal: AbortSignal,
    parameters: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(path, 'https://restapi.amap.com');
    url.search = new URLSearchParams({ ...parameters, key, output: 'JSON' }).toString();
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('AMap request failed.');

    return response.json();
  }
}
