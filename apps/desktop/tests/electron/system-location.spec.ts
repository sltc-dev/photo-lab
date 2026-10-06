// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureSystemLocationAccess,
  isSystemLocationAuthorized,
} from '../../electron/system-location';

const NOT_DETERMINED = 0;
const RESTRICTED = 1;
const DENIED = 2;
const AUTHORIZED_ALWAYS = 3;
const AUTHORIZED_WHEN_IN_USE = 4;

function locationManager(status: number, decision?: number) {
  let current = status;
  const getStatus = vi.fn(() => current);
  const requestWhenInUse = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        if (decision === undefined) return;
        current = decision;
        resolve(decision);
      }),
  );
  return { getStatus, requestWhenInUse };
}

describe('system location access', () => {
  afterEach(() => vi.useRealTimers());

  it('leaves non-macOS platforms to the operating system', async () => {
    const load = vi.fn();
    await expect(ensureSystemLocationAccess('win32', load)).resolves.toBe(true);
    expect(isSystemLocationAuthorized('win32', load)).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    ['authorized always', AUTHORIZED_ALWAYS, true],
    ['authorized when in use', AUTHORIZED_WHEN_IN_USE, true],
    ['denied', DENIED, false],
    ['restricted', RESTRICTED, false],
  ])('returns the existing %s decision without prompting', async (_name, status, granted) => {
    const manager = locationManager(status);
    await expect(ensureSystemLocationAccess('darwin', () => manager)).resolves.toBe(granted);
    expect(isSystemLocationAuthorized('darwin', () => manager)).toBe(granted);
    expect(manager.requestWhenInUse).not.toHaveBeenCalled();
  });

  it.each([
    ['allows', AUTHORIZED_ALWAYS, true],
    ['declines', DENIED, false],
  ])('prompts and returns once the user %s', async (_name, decision, granted) => {
    const manager = locationManager(NOT_DETERMINED, decision);
    await expect(ensureSystemLocationAccess('darwin', () => manager)).resolves.toBe(granted);
    expect(manager.requestWhenInUse).toHaveBeenCalledOnce();
  });

  it('denies when the prompt is never answered', async () => {
    vi.useFakeTimers();
    const manager = locationManager(NOT_DETERMINED);
    const result = ensureSystemLocationAccess('darwin', () => manager);
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(result).resolves.toBe(false);
  });

  it('reports CoreLocation load failures', async () => {
    const load = () => {
      throw new Error('missing');
    };
    await expect(ensureSystemLocationAccess('darwin', load)).rejects.toThrow('missing');
    expect(isSystemLocationAuthorized('darwin', load)).toBe(false);
  });
});
