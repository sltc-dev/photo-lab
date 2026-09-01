ALTER TABLE "PhotoComment"
ALTER COLUMN "content" DROP NOT NULL,
ADD COLUMN "stickerKey" VARCHAR(32);

ALTER TABLE "PhotoComment"
ADD CONSTRAINT "PhotoComment_content_or_sticker" CHECK (
  ("content" IS NOT NULL AND "stickerKey" IS NULL)
  OR ("content" IS NULL AND "stickerKey" IS NOT NULL)
);
