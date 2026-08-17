CREATE TYPE "PhotoKind" AS ENUM ('ORIGINAL', 'EDITED');

ALTER TABLE "Photo"
ADD COLUMN "kind" "PhotoKind" NOT NULL DEFAULT 'ORIGINAL';

-- 兼容上线前已经通过编辑器生成的效果图；以后不再依赖文件名判断。
UPDATE "Photo"
SET "kind" = 'EDITED'
WHERE "fileName" ~* '\.edited\.[^.]+$';

CREATE INDEX "Photo_projectId_kind_createdAt_idx"
ON "Photo"("projectId", "kind", "createdAt");
