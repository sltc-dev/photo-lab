import { z } from 'zod';
import { fetchWithAuth, resolveApiUrl } from './http';

const addressSchema = z.object({ label: z.string().trim().min(1) });

export type LocationSample = {
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export async function readLocationAddress(location: LocationSample, signal: AbortSignal) {
  const age = Date.now() - Date.parse(location.capturedAt);
  if (!Number.isFinite(age) || age < -30_000 || age > 2 * 60_000) {
    throw new Error('请更新位置后重新解析地址。');
  }

  const response = await fetchWithAuth(resolveApiUrl('/locations/address'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('暂时无法解析地址，请稍后重试。');

  const result = addressSchema.safeParse(await response.json());
  if (!result.success) throw new Error('暂时无法解析地址，请稍后重试。');

  return result.data;
}
