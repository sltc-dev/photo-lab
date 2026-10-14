export type NearbyFriendsConfig = {
  location: { ttlMs: number; refreshIntervalMs: number; maxClockSkewMs: number };
  nearby: {
    radiusMeters: number;
    maxAccuracyMeters: number;
    distanceBucketMeters: number;
  };
  friendRequest: { ttlMs: number; cooldownMs: number };
  maintenance: { intervalMs: number };
  list: { refetchIntervalMs: number };
};

export const nearbyFriendsConfig: NearbyFriendsConfig = {
  location: {
    ttlMs: 6 * 60 * 60_000,
    refreshIntervalMs: 60_000,
    maxClockSkewMs: 30_000,
  },
  nearby: {
    radiusMeters: 1000,
    maxAccuracyMeters: 200,
    distanceBucketMeters: 50,
  },
  friendRequest: {
    ttlMs: 7 * 24 * 60 * 60_000,
    cooldownMs: 24 * 60 * 60_000,
  },
  maintenance: {
    intervalMs: 60_000,
  },
  list: {
    refetchIntervalMs: 30_000,
  },
};

export const nearbyFriendsConfigProvider = {
  provide: 'NEARBY_FRIENDS_CONFIG',
  useValue: nearbyFriendsConfig,
};
