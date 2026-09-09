CREATE TABLE "PhotoComment" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotoComment_photoId_createdAt_id_idx" ON "PhotoComment"("photoId", "createdAt", "id");
CREATE INDEX "PhotoComment_userId_idx" ON "PhotoComment"("userId");

ALTER TABLE "PhotoComment"
ADD CONSTRAINT "PhotoComment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoComment"
ADD CONSTRAINT "PhotoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
