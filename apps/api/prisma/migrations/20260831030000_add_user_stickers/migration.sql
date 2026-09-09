CREATE TABLE "UserSticker" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSticker_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSticker_objectKey_key" ON "UserSticker"("objectKey");
CREATE INDEX "UserSticker_userId_createdAt_idx" ON "UserSticker"("userId", "createdAt");
ALTER TABLE "UserSticker" ADD CONSTRAINT "UserSticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
