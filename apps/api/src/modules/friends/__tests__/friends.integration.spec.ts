import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { nearbyFriendsConfig } from '../../../config/nearby-friends.config';
import { LocationsService } from '../../locations/locations.service';
import type { NotificationEventPublisher } from '../../notifications/notification-event-publisher.service';
import { FriendsService } from '../friends.service';

const databaseUrl = process.env.FRIENDS_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('nearby friends on PostgreSQL and PostGIS', () => {
  let prisma: PrismaService;
  let locations: LocationsService;
  let friends: FriendsService;
  let userIds: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error(
        'FRIENDS_TEST_DATABASE_URL must point to a dedicated database ending in _test.',
      );
    }

    prisma = new PrismaService({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    locations = new LocationsService(prisma, nearbyFriendsConfig);
    friends = new FriendsService(prisma, locations, {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationEventPublisher);
  });

  beforeEach(async () => {
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    userIds = [];

    for (let index = 0; index < 3; index += 1) {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@friends-test.example`,
          username: `Test user ${index}`,
          passwordHash: 'test-only-password-hash',
        },
      });
      userIds.push(user.id);
      await locations.updateSettings(user.id, {
        locationEnabled: true,
        discoverable: true,
      });
      await locations.reportLocation(user.id, {
        latitude: 35,
        longitude: 139 + index * 0.001,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  const submit = () => friends.createRequest(userIds[0]!, { recipientUserId: userIds[1]! });

  it('filters by geography distance and hides private fields', async () => {
    const origin = userIds[0]!;
    const target = userIds[1]!;
    for (const distance of [999, 1001]) {
      await prisma.$executeRaw`UPDATE "UserLocation" SET "latitude" = ST_Y(ST_Project(ST_SetSRID(ST_MakePoint(139, 35),4326)::geography, ${distance}, 0)::geometry), "longitude" = ST_X(ST_Project(ST_SetSRID(ST_MakePoint(139, 35),4326)::geography, ${distance}, 0)::geometry) WHERE "userId" = ${target}`;
      const result = await locations.getNearby(origin);
      expect(result.items.some((item) => item.userId === target)).toBe(distance === 999);
      expect(JSON.stringify(result)).not.toMatch(/latitude|longitude|passwordHash|email/);
    }
  });

  it('accepts a five-hour-old location but excludes one older than six hours', async () => {
    const target = userIds[1]!;
    await prisma.userLocation.update({
      where: { userId: target },
      data: { capturedAt: new Date(Date.now() - 5 * 3_600_000) },
    });
    expect(
      (await locations.getNearby(userIds[0]!)).items.some((item) => item.userId === target),
    ).toBe(true);
    await prisma.userLocation.update({
      where: { userId: target },
      data: { capturedAt: new Date(Date.now() - 7 * 3_600_000) },
    });
    expect(
      (await locations.getNearby(userIds[0]!)).items.some((item) => item.userId === target),
    ).toBe(false);
  });

  it('serializes opposite-direction requests into a single pending application', async () => {
    const [first, second] = await Promise.all([
      submit(),
      friends.createRequest(userIds[1]!, { recipientUserId: userIds[0]! }),
    ]);
    expect(first.requestId).toBe(second.requestId);
    expect(
      await prisma.friendRequest.count({
        where: { status: 'PENDING', requesterId: { in: userIds } },
      }),
    ).toBe(1);
    expect(await prisma.friendship.count({ where: { userLowId: { in: userIds } } })).toBe(0);
  });

  it('keeps friendship symmetric and never revives it through an old request', async () => {
    const request = await submit();
    const [first, second] = await Promise.all([
      friends.resolveRequest(userIds[1]!, request.requestId, 'accept'),
      friends.resolveRequest(userIds[1]!, request.requestId, 'accept'),
    ]);
    expect(first.relationshipId).toBe(second.relationshipId);
    expect((await friends.listFriends(userIds[0]!)).items).toHaveLength(1);
    expect((await friends.listFriends(userIds[1]!)).items).toHaveLength(1);
    await friends.removeFriend(userIds[0]!, first.relationshipId!);
    const repeated = await friends.resolveRequest(userIds[1]!, request.requestId, 'accept');
    expect(repeated.removedAt).not.toBeNull();
    expect((await friends.listFriends(userIds[1]!)).items).toHaveLength(0);
    expect(
      (await prisma.friendRequest.findUniqueOrThrow({ where: { id: request.requestId } })).status,
    ).toBe('ACCEPTED');
  });

  it('disables discovery and rejects location reports while disabled', async () => {
    const target = userIds[1]!;
    await locations.updateSettings(target, {
      locationEnabled: false,
      discoverable: false,
    });
    await expect(
      locations.reportLocation(target, {
        latitude: 35,
        longitude: 139,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    expect(await prisma.userLocation.findUnique({ where: { userId: target } })).toBeNull();
    expect(
      (await locations.getNearby(userIds[0]!)).items.some((item) => item.userId === target),
    ).toBe(false);
  });

  it('does not refresh expiry when a duplicate position is reported', async () => {
    const original = await locations.getLocation(userIds[0]!);
    expect(original).not.toBeNull();
    const retried = await locations.reportLocation(userIds[0]!, {
      latitude: 0,
      longitude: 0,
      accuracyMeters: 10,
      capturedAt: original!.capturedAt,
    });
    expect(retried.latitude).toBe(original!.latitude);
    expect(retried.expiresAt).toBe(original!.expiresAt);
  });
});
