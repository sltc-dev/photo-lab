// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { registerLocationPermissions } from '../../electron/ipc/location.ipc';
import { locationIpcChannels } from '../../electron/ipc/location.channels';

const ipc = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn() }));
const system = vi.hoisted(() => ({
  ensureSystemLocationAccess: vi.fn<() => Promise<boolean>>(),
  isSystemLocationAuthorized: vi.fn<() => boolean>(),
}));
vi.mock('electron', () => ({ ipcMain: ipc }));
vi.mock('../../electron/system-location', () => system);

function harness() {
  const session = { setPermissionCheckHandler: vi.fn(), setPermissionRequestHandler: vi.fn() };
  const mainFrame = { url: 'file:///app/index.html#/friends' };
  const on = vi.fn();
  const contents = {
    mainFrame,
    session,
    on,
    getURL: () => mainFrame.url,
  } as unknown as WebContents;
  registerLocationPermissions(contents, undefined, 'file:///app/index.html');
  const handlerFor = (channel: string) =>
    ipc.handle.mock.calls.find(([name]) => name === channel)![1];
  const requestAccess = handlerFor(locationIpcChannels.requestAccess);
  const revokeAccess = handlerFor(locationIpcChannels.revokeAccess);
  const event = { sender: contents, senderFrame: mainFrame };
  const details = { isMainFrame: true, requestingUrl: mainFrame.url };
  const check = () =>
    session.setPermissionCheckHandler.mock.calls[0]![0](contents, 'geolocation', '', details);
  const request = (sender: unknown, permission: string, requestDetails = details) => {
    const callback = vi.fn();
    session.setPermissionRequestHandler.mock.calls[0]![0](
      sender,
      permission,
      callback,
      requestDetails,
    );
    return callback.mock.calls[0]![0] as boolean;
  };
  return { mainFrame, on, contents, event, details, requestAccess, revokeAccess, check, request };
}

describe('browser location permission boundary', () => {
  beforeEach(() => {
    ipc.handle.mockClear();
    system.ensureSystemLocationAccess.mockReset().mockResolvedValue(true);
    system.isSystemLocationAuthorized.mockReset().mockReturnValue(true);
  });

  it('requests system access first and returns the decision to the page', async () => {
    const h = harness();
    await expect(h.requestAccess(h.event)).resolves.toBe(true);
    expect(system.ensureSystemLocationAccess).toHaveBeenCalledOnce();

    system.ensureSystemLocationAccess.mockResolvedValueOnce(false);
    await expect(h.requestAccess(h.event)).resolves.toBe(false);
  });

  it('answers Chromium synchronously for the trusted main frame only', async () => {
    const h = harness();
    expect(h.check()).toBe(false);
    expect(h.request(h.contents, 'geolocation')).toBe(false);

    await h.requestAccess(h.event);
    expect(h.check()).toBe(true);
    expect(h.request(h.contents, 'geolocation')).toBe(true);
    expect(h.request(h.contents, 'media')).toBe(false);
    expect(h.request(null, 'geolocation')).toBe(false);
    expect(h.request(h.contents, 'geolocation', { ...h.details, isMainFrame: false })).toBe(false);
    expect(
      h.request(h.contents, 'geolocation', {
        ...h.details,
        requestingUrl: 'https://other.example',
      }),
    ).toBe(false);

    system.isSystemLocationAuthorized.mockReturnValue(false);
    expect(h.request(h.contents, 'geolocation')).toBe(false);
  });

  it('stops allowing geolocation after access is revoked', async () => {
    const h = harness();
    await h.requestAccess(h.event);
    h.revokeAccess(h.event);
    expect(h.check()).toBe(false);
  });

  it('rejects foreign IPC senders', () => {
    const h = harness();
    expect(() => h.requestAccess({ ...h.event, sender: {} })).toThrow('Untrusted');
    expect(() => h.revokeAccess({ ...h.event, senderFrame: { url: h.mainFrame.url } })).toThrow(
      'Untrusted',
    );
    h.mainFrame.url = 'https://other.example';
    expect(() => h.requestAccess(h.event)).toThrow('Untrusted');
    expect(system.ensureSystemLocationAccess).not.toHaveBeenCalled();
  });

  it.each(['navigation', 'destroy'])('revokes location permission on %s', async (action) => {
    const h = harness();
    await h.requestAccess(h.event);
    const name = action === 'destroy' ? 'destroyed' : 'did-start-navigation';
    h.on.mock.calls.find(([event]) => event === name)![1]({}, '', false, true);
    expect(h.check()).toBe(false);
  });
});
