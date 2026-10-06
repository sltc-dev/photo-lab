CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "UserLocationSetting" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "locationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "discoverable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK (NOT "discoverable" OR "locationEnabled")
);

CREATE TABLE "UserLocation" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "latitude" DOUBLE PRECISION NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" DOUBLE PRECISION NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "accuracyMeters" DOUBLE PRECISION NOT NULL CHECK ("accuracyMeters" > 0 AND "accuracyMeters" <= 100000),
  "position" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "UserLocation_position_gist" ON "UserLocation" USING GIST ("position");
CREATE INDEX "UserLocation_expiresAt_idx" ON "UserLocation" ("expiresAt");
CREATE INDEX "UserLocation_capturedAt_idx" ON "UserLocation" ("capturedAt");

CREATE TABLE "FriendRequest" (
  "id" TEXT PRIMARY KEY,
  "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FriendRequest_distinct_users_check" CHECK ("requesterId" <> "recipientId"),
  CHECK ("expiresAt" > "requestedAt"),
  CHECK (("status" = 'PENDING') = ("resolvedAt" IS NULL))
);
CREATE UNIQUE INDEX "FriendRequest_pending_pair_key" ON "FriendRequest" (
  LEAST("requesterId" COLLATE "C", "recipientId" COLLATE "C"),
  GREATEST("requesterId" COLLATE "C", "recipientId" COLLATE "C")
) WHERE "status" = 'PENDING';
CREATE INDEX "FriendRequest_recipientId_status_requestedAt_id_idx" ON "FriendRequest" ("recipientId", "status", "requestedAt", "id");
CREATE INDEX "FriendRequest_requesterId_status_requestedAt_id_idx" ON "FriendRequest" ("requesterId", "status", "requestedAt", "id");
CREATE INDEX "FriendRequest_requesterId_requestedAt_idx" ON "FriendRequest" ("requesterId", "requestedAt");
CREATE INDEX "FriendRequest_pending_expiry_idx" ON "FriendRequest" ("expiresAt", "id") WHERE "status" = 'PENDING';

CREATE TABLE "Friendship" (
  "id" TEXT PRIMARY KEY,
  "userLowId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userHighId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sourceRequestId" TEXT NOT NULL REFERENCES "FriendRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CHECK ("userLowId" COLLATE "C" < "userHighId" COLLATE "C"),
  CHECK ("removedAt" IS NULL OR "removedAt" >= "createdAt")
);
CREATE UNIQUE INDEX "Friendship_sourceRequestId_key" ON "Friendship" ("sourceRequestId");
CREATE UNIQUE INDEX "Friendship_active_pair_key" ON "Friendship" ("userLowId", "userHighId") WHERE "removedAt" IS NULL;
CREATE INDEX "Friendship_low_active_idx" ON "Friendship" ("userLowId", "createdAt", "id") WHERE "removedAt" IS NULL;
CREATE INDEX "Friendship_high_active_idx" ON "Friendship" ("userHighId", "createdAt", "id") WHERE "removedAt" IS NULL;
CREATE INDEX "Friendship_userLowId_userHighId_removedAt_idx" ON "Friendship" ("userLowId", "userHighId", "removedAt");
