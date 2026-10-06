import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { NotificationEventPublisher } from '../../notifications/notification-event-publisher.service';
import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { LocationsService } from '../../locations/locations.service';
import { FriendsService } from '../friends.service';

function harness(status: string, removed: boolean, age = 1000) {
  const resolvedAt = new Date(Date.now() - age);
  const historical = {
    id: 'old-request',
    requesterId: 'a',
    recipientId: 'b',
    status,
    resolvedAt,
    expiresAt: resolvedAt,
  };
  const relationship = { userLowId: 'a', userHighId: 'b', removedAt: resolvedAt };
  const create = vi.fn(async ({ data }) => ({
    ...data,
    id: 'new-request',
    status: 'PENDING',
    resolvedAt: null,
    requester: { id: 'a', username: 'Alice' },
    recipient: { id: 'b', username: 'Bob' },
    friendship: null,
  }));
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'b' }) },
    friendRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn(async ({ where }) => {
        const matches =
          typeof where.status === 'string'
            ? where.status === status
            : where.status.in.includes(status);
        return matches ? historical : null;
      }),
      findMany: vi.fn(async ({ where }) => {
        const matches = where.AND[1].OR.some(
          (condition: {
            status: string | { in: string[] };
            resolvedAt?: { gt: Date };
            expiresAt?: { gt?: Date; lte?: Date };
          }) => {
            const sameStatus =
              typeof condition.status === 'string'
                ? condition.status === status
                : condition.status.in.includes(status);
            return (
              sameStatus &&
              (!condition.resolvedAt || resolvedAt > condition.resolvedAt.gt) &&
              (!condition.expiresAt?.gt || resolvedAt > condition.expiresAt.gt) &&
              (!condition.expiresAt?.lte || resolvedAt <= condition.expiresAt.lte)
            );
          },
        );
        return matches ? [historical] : [];
      }),
      create,
    },
    friendship: {
      findFirst: vi.fn(async ({ where }) =>
        removed && where.removedAt !== null ? relationship : null,
      ),
      findMany: vi.fn(async ({ where }) =>
        removed && where.AND[1].removedAt !== null ? [relationship] : [],
      ),
    },
    notification: { create: vi.fn().mockResolvedValue({ id: 'notice', publishedAt: new Date() }) },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ userId: 'b', username: 'Bob', distance: 20 }]),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((run) => run(prisma));
  const locations = new LocationsService(prisma as unknown as PrismaService, nearbyFriendsConfig);
  vi.spyOn(locations, 'assertNearby').mockResolvedValue(undefined);
  vi.spyOn(locations, 'assertSearchLocation').mockResolvedValue(undefined);
  const friends = new FriendsService(prisma as unknown as PrismaService, locations, {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationEventPublisher);
  return { friends, locations, create };
}

describe('rejection-only friend request cooldown', () => {
  it.each(['CANCELLED', 'EXPIRED', 'PENDING', 'ACCEPTED'])(
    'allows a new request after %s history without a cooldown',
    async (status) => {
      const h = harness(status, status === 'ACCEPTED');
      // Expired pending rows are finalized by the transaction before the lookup.
      if (status !== 'PENDING') {
        await expect(h.friends.createRequest('a', { recipientUserId: 'b' })).resolves.toMatchObject(
          { requestId: 'new-request' },
        );
        expect(h.create).toHaveBeenCalledOnce();
      }
      const page = await h.locations.getNearby('a');
      expect(page.items[0]).toMatchObject({ relationshipState: 'NONE', cooldownUntil: null });
    },
  );

  it('blocks both application and nearby eligibility after rejection', async () => {
    const h = harness('REJECTED', false);
    await expect(h.friends.createRequest('a', { recipientUserId: 'b' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FRIEND_REQUEST_COOLDOWN' }),
    });
    expect(h.create).not.toHaveBeenCalled();
    expect((await h.locations.getNearby('a')).items[0]).toMatchObject({
      relationshipState: 'COOLDOWN',
      cooldownUntil: expect.any(String),
    });
  });

  it('allows applying when the rejection cooldown has elapsed', async () => {
    const h = harness('REJECTED', false, nearbyFriendsConfig.friendRequest.cooldownMs + 1000);
    await expect(h.friends.createRequest('a', { recipientUserId: 'b' })).resolves.toMatchObject({
      requestId: 'new-request',
    });
    expect((await h.locations.getNearby('a')).items[0]).toMatchObject({
      relationshipState: 'NONE',
      cooldownUntil: null,
    });
  });
});
