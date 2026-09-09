ALTER TABLE "Photo"
ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "favoriteCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Photo" AS photo
SET "likeCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "PhotoLike" AS photo_like
  WHERE photo_like."photoId" = photo."id"
),
"favoriteCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "PhotoFavorite" AS photo_favorite
  WHERE photo_favorite."photoId" = photo."id"
);

ALTER TABLE "Photo"
ADD CONSTRAINT "Photo_likeCount_nonnegative" CHECK ("likeCount" >= 0),
ADD CONSTRAINT "Photo_favoriteCount_nonnegative" CHECK ("favoriteCount" >= 0);
