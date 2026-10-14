import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { LocationsService } from '../locations.service';

function harness() {
  const settings = { userId: 'user-a', locationEnabled: true, discoverable: true };
  const existing = {
    latitude: 35,
    longitude: 139,
    accuracyMeters: 10,
    capturedAt: new Date(),
    expiresAt: new Date(Date.now() + nearbyFriendsConfig.location.ttlMs),
  };
  const locationWrite = vi.fn();
  const deleteLocations = vi.fn();
  const updateSettings = vi
    .fn()
    .mockResolvedValue({ ...settings, locationEnabled: false, discoverable: false });
  const transaction = {
    userLocationSetting: {
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue(settings),
      update: updateSettings,
    },
    userLocation: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: locationWrite,
      deleteMany: deleteLocations,
    },
    $queryRaw: vi.fn(),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: unknown) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as PrismaService;
  return {
    service: new LocationsService(prisma, nearbyFriendsConfig),
    settings,
    existing,
    locationWrite,
    deleteLocations,
    updateSettings,
  };
}

describe('location write policy', () => {
  it('rejects reports when location is disabled in the database', async () => {
    const h = harness();
    h.settings.locationEnabled = false;
    await expect(
      h.service.reportLocation('user-a', {
        latitude: 0,
        longitude: 0,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    expect(h.locationWrite).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer sample or prolong its effective expiry', async () => {
    const h = harness();
    const result = await h.service.reportLocation('user-a', {
      latitude: 0,
      longitude: 0,
      accuracyMeters: 10,
      capturedAt: new Date(h.existing.capturedAt.getTime() - 60_000).toISOString(),
    });
    expect(result.latitude).toBe(35);
    expect(result.expiresAt).toBe(
      new Date(h.existing.capturedAt.getTime() + nearbyFriendsConfig.location.ttlMs).toISOString(),
    );
    expect(h.locationWrite).not.toHaveBeenCalled();
  });

  it('turns off discovery and removes the saved location with the setting update', async () => {
    const h = harness();
    await h.service.updateSettings('user-a', {
      locationEnabled: false,
      discoverable: true,
    });
    expect(h.updateSettings).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
      data: { locationEnabled: false, discoverable: false },
    });
    expect(h.deleteLocations).toHaveBeenCalledWith({ where: { userId: 'user-a' } });
  });
});
