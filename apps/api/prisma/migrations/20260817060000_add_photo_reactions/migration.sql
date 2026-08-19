CREATE TABLE "PhotoLike" (
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoLike_pkey" PRIMARY KEY ("userId", "photoId")
);

CREATE TABLE "PhotoFavorite" (
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoFavorite_pkey" PRIMARY KEY ("userId", "photoId")
);

CREATE INDEX "PhotoLike_photoId_createdAt_idx" ON "PhotoLike"("photoId", "createdAt");
CREATE INDEX "PhotoFavorite_photoId_createdAt_idx" ON "PhotoFavorite"("photoId", "createdAt");

ALTER TABLE "PhotoLike"
ADD CONSTRAINT "PhotoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoLike"
ADD CONSTRAINT "PhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoFavorite"
ADD CONSTRAINT "PhotoFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoFavorite"
ADD CONSTRAINT "PhotoFavorite_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
