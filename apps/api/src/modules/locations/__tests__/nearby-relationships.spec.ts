import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { LocationsService } from '../locations.service';

function harness(
  requests: unknown[] = [],
  friendships: unknown[] = [],
  candidates = [{ userId: 'other', username: 'Other', distance: 78 }],
) {
  const prisma = {
    userLocationSetting: { findUnique: vi.fn().mockResolvedValue({ locationEnabled: true }) },
    userLocation: {
      findUnique: vi.fn().mockResolvedValue({ capturedAt: new Date(), accuracyMeters: 40 }),
    },
    $queryRaw: vi.fn().mockResolvedValue(candidates),
    friendRequest: { findMany: vi.fn().mockResolvedValue(requests) },
    friendship: { findMany: vi.fn().mockResolvedValue(friendships) },
  };
  return {
    prisma,
    service: new LocationsService(prisma as unknown as PrismaService, nearbyFriendsConfig),
  };
}

const pending = {
  id: 'request',
  requesterId: 'self',
  recipientId: 'other',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 60_000),
};

describe('nearby relationship results', () => {
  it.each([
    { requests: [], friendships: [], state: 'NONE', requestId: null, relationshipId: null },
    {
      requests: [pending],
      friendships: [],
      state: 'OUTGOING_PENDING',
      requestId: 'request',
      relationshipId: null,
    },
    {
      requests: [{ ...pending, requesterId: 'other', recipientId: 'self' }],
      friendships: [],
      state: 'INCOMING_PENDING',
      requestId: 'request',
      relationshipId: null,
    },
    {
      requests: [{ ...pending, status: 'REJECTED', resolvedAt: new Date() }],
      friendships: [],
      state: 'COOLDOWN',
      requestId: null,
      relationshipId: null,
    },
    {
      requests: [pending],
      friendships: [{ id: 'friend', userLowId: 'self', userHighId: 'other', removedAt: null }],
      state: 'FRIEND',
      requestId: 'request',
      relationshipId: 'friend',
    },
  ])(
    'returns $state with the existing action IDs',
    async ({ requests, friendships, state, requestId, relationshipId }) => {
      const { service } = harness(requests, friendships);
      const result = await service.getNearby('self');
      expect(result.items[0]).toMatchObject({
        relationshipState: state,
        requestId,
        relationshipId,
        approximateDistanceMeters: 100,
      });
    },
  );

  it('returns every nearby candidate beyond the former 50-user cap', async () => {
    const candidates = Array.from({ length: 75 }, (_, index) => ({
      userId: `other-${index}`,
      username: `Other ${index}`,
      distance: index + 1,
    }));
    const { service, prisma } = harness([], [], candidates);
    const result = await service.getNearby('self');

    expect(result.items).toHaveLength(75);
    expect(result.items[74]?.userId).toBe('other-74');
    expect(prisma.friendRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { requesterId: 'self', recipientId: { in: candidates.map((item) => item.userId) } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('skips relationship queries when there are no nearby candidates', async () => {
    const { service, prisma } = harness([], [], []);
    expect((await service.getNearby('self')).items).toEqual([]);
    expect(prisma.friendRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
  });
});
