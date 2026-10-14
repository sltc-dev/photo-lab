import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { LocationsService } from '../../locations/locations.service';
import type { NotificationEventPublisher } from '../../notifications/notification-event-publisher.service';
import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { FriendsService } from '../friends.service';

function harness() {
  const request = {
    id: 'request-old',
    requesterId: 'user-a',
    recipientId: 'user-b',
    status: 'PENDING',
    requestedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    resolvedAt: null,
    requester: { id: 'user-a', username: 'Alice' },
    recipient: { id: 'user-b', username: 'Bob' },
    friendship: null,
  };
  const requestFind = vi.fn().mockResolvedValue(request);
  const requestUpdate = vi.fn();
  const requestList = vi.fn().mockResolvedValue([request]);
  const friendshipCreate = vi.fn();
  const notificationCreate = vi.fn().mockResolvedValue({ id: 'notice-a', publishedAt: new Date() });
  const publish = vi.fn().mockResolvedValue(undefined);
  const transaction = {
    friendRequest: {
      findUnique: requestFind,
      update: requestUpdate,
      findUniqueOrThrow: requestFind,
    },
    friendship: { create: friendshipCreate },
    notification: { create: notificationCreate },
  };
  const prisma = {
    friendRequest: { findUnique: requestFind, findMany: requestList },
    $transaction: vi.fn(async (callback: (value: unknown) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as PrismaService;
  const locations = { config: nearbyFriendsConfig } as unknown as LocationsService;
  const service = new FriendsService(prisma, locations, {
    publish,
  } as unknown as NotificationEventPublisher);
  return {
    service,
    request,
    requestFind,
    requestUpdate,
    requestList,
    friendshipCreate,
    notificationCreate,
    publish,
  };
}

describe('friend request authorization and atomic acceptance', () => {
  it('prevents the requester accepting their own request', async () => {
    const h = harness();
    await expect(h.service.resolveRequest('user-a', h.request.id, 'accept')).rejects.toThrow();
    expect(h.requestUpdate).not.toHaveBeenCalled();
    expect(h.friendshipCreate).not.toHaveBeenCalled();
  });

  it('does not expose a request to nonparticipants', async () => {
    const h = harness();
    await expect(h.service.resolveRequest('user-c', h.request.id, 'accept')).rejects.toThrow();
    expect(h.requestUpdate).not.toHaveBeenCalled();
  });

  it('creates the relationship and personal notification only after acceptance', async () => {
    const h = harness();
    await h.service.resolveRequest('user-b', h.request.id, 'accept');
    expect(h.requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
    );
    expect(h.friendshipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceRequestId: h.request.id,
        userLowId: 'user-a',
        userHighId: 'user-b',
      }),
    });
    expect(h.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientUserId: 'user-a',
        type: 'FRIEND_ACCEPTED',
      }),
    });
    expect(h.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      h.notificationCreate.mock.invocationCallOrder[0]!,
    );
  });

  it('does not create a friendship when the request expired', async () => {
    const h = harness();
    h.request.expiresAt = new Date(Date.now() - 1);
    await expect(h.service.resolveRequest('user-b', h.request.id, 'accept')).rejects.toThrow();
    expect(h.friendshipCreate).not.toHaveBeenCalled();
  });

  it('never restores a removed friendship on repeated acceptance', async () => {
    const h = harness();
    h.requestFind.mockResolvedValue({
      ...h.request,
      status: 'ACCEPTED',
      resolvedAt: new Date(),
      friendship: { id: 'friendship-old', removedAt: new Date() },
    });
    const result = await h.service.resolveRequest('user-b', h.request.id, 'accept');
    expect(result.relationshipId).toBe('friendship-old');
    expect(result.removedAt).not.toBeNull();
    expect(h.friendshipCreate).not.toHaveBeenCalled();
    expect(h.notificationCreate).not.toHaveBeenCalled();
  });

  it('does not broadcast when notification persistence fails', async () => {
    const h = harness();
    h.notificationCreate.mockRejectedValue(new Error('Database failure'));
    await expect(h.service.resolveRequest('user-b', h.request.id, 'accept')).rejects.toThrow(
      'Database failure',
    );
    expect(h.publish).not.toHaveBeenCalled();
  });

  it('keeps the committed operation successful when Redis is unavailable', async () => {
    const h = harness();
    h.publish.mockRejectedValue(new Error('Redis unavailable'));
    await expect(h.service.resolveRequest('user-b', h.request.id, 'accept')).resolves.toMatchObject(
      { requestId: h.request.id },
    );
  });
});

describe('friend request history', () => {
  it('returns all requests without a pagination limit', async () => {
    const h = harness();
    h.requestList.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => ({ ...h.request, id: `request-${index}` })),
    );

    const result = await h.service.listRequests('user-a', { direction: 'outgoing' });

    expect(result.items).toHaveLength(60);
    expect(h.requestList.mock.calls[0]?.[0]).not.toHaveProperty('take');
  });

  it('returns outgoing history scoped to the requester and exposes expired pending requests', async () => {
    const h = harness();
    h.requestList.mockResolvedValue([
      { ...h.request, status: 'REJECTED', resolvedAt: new Date() },
      { ...h.request, id: 'expired', expiresAt: new Date(Date.now() - 1000) },
    ]);
    const result = await h.service.listRequests('user-a', { direction: 'outgoing' });
    expect(h.requestList).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requesterId: 'user-a' },
      }),
    );
    expect(result.items.map((item) => item.status)).toEqual(['REJECTED', 'EXPIRED']);
    expect(result.items[0]?.username).toBe('Bob');
  });

  it('returns incoming history scoped to the recipient', async () => {
    const h = harness();
    await h.service.listRequests('user-b', { direction: 'incoming' });
    expect(h.requestList).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 'user-b' },
      }),
    );
  });
});

describe('request status filtering', () => {
  it.each(['incoming', 'outgoing'] as const)('filters rejected %s requests', async (direction) => {
    const h = harness();
    await h.service.listRequests('user-a', { direction, status: 'REJECTED' });
    expect(h.requestList).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          [direction === 'incoming' ? 'recipientId' : 'requesterId']: 'user-a',
          AND: [{ status: 'REJECTED' }],
        },
      }),
    );
  });

  it('includes overdue pending records in the expired filter', async () => {
    const h = harness();
    await h.service.listRequests('user-a', { direction: 'incoming', status: 'EXPIRED' });
    expect(h.requestList).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientId: 'user-a',
          AND: [
            {
              OR: [
                { status: 'EXPIRED' },
                { status: 'PENDING', expiresAt: { lte: expect.any(Date) } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('excludes overdue records from the pending filter', async () => {
    const h = harness();
    await h.service.listRequests('user-a', { direction: 'incoming', status: 'PENDING' });
    expect(h.requestList).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientId: 'user-a',
          AND: [{ status: 'PENDING', expiresAt: { gt: expect.any(Date) } }],
        },
      }),
    );
  });
});
