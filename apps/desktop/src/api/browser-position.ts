export function getBrowserPosition(signal: AbortSignal): Promise<GeolocationPosition> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (!navigator.geolocation) return Promise.reject(new Error('当前环境不支持定位。'));

  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    const finish = (callback: () => void) => {
      signal.removeEventListener('abort', abort);
      if (!signal.aborted) callback();
    };
    signal.addEventListener('abort', abort, { once: true });
    navigator.geolocation.getCurrentPosition(
      (position) => finish(() => resolve(position)),
      (error) => finish(() => reject(error)),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
