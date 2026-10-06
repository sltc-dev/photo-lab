import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CurrentLocationAddress } from '../../../src/components/friends/CurrentLocationAddress';
import { readLocationAddress } from '../../../src/api/location-address';

const sample = () => ({
  latitude: 35,
  longitude: 139,
  accuracyMeters: 40,
  capturedAt: new Date().toISOString(),
});

function mount(uploaded = true) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <CurrentLocationAddress location={sample()} userId="user-a" uploaded={uploaded} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('current location name', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('automatically resolves the current location through the application API', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'TokyoShibuya' }),
    });
    vi.stubGlobal('fetch', fetcher);
    mount();
    expect(await screen.findByText('TokyoShibuya')).toBeInTheDocument();
    expect(screen.getByText('已同步')).toBeInTheDocument();
    expect(screen.queryByText('经度：139.000000')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', { name: '查看经纬度、定位精度和更新时间' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('经度：139.000000');
    expect(screen.getByRole('tooltip')).toHaveTextContent('纬度：35.000000');
    expect(screen.getByRole('tooltip')).toHaveTextContent('定位精度：约 40 米');
    const request = fetcher.mock.calls[0]![0] as Request;
    expect(new URL(request.url).pathname).toBe('/locations/address');
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({ latitude: 35, longitude: 139 });
  });

  it('shows a coordinates fallback when the address provider fails without automatic retries', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetcher);
    mount();
    expect(await screen.findByText('暂时无法解析')).toBeInTheDocument();
    expect(screen.getByText(/经纬度仍可使用/)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts the request when the location component unmounts', async () => {
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const view = mount();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const signal = (fetcher.mock.calls[0]![0] as Request).signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not send an old saved coordinate to the address service', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      readLocationAddress(
        { ...sample(), capturedAt: new Date(Date.now() - 300_000).toISOString() },
        new AbortController().signal,
      ),
    ).rejects.toThrow('请更新位置');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an empty provider response instead of displaying a fabricated name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(readLocationAddress(sample(), new AbortController().signal)).rejects.toThrow(
      '暂时无法解析地址',
    );
  });
});
