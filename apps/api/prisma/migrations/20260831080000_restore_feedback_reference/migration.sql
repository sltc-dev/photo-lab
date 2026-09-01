ALTER TABLE "Feedback" ADD COLUMN "referenceId" TEXT;

-- 为迁移前已经存在的反馈生成稳定编号，避免丢失历史数据。
UPDATE "Feedback"
SET "referenceId" = 'PL-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 12));

ALTER TABLE "Feedback" ALTER COLUMN "referenceId" SET NOT NULL;
CREATE UNIQUE INDEX "Feedback_referenceId_key" ON "Feedback"("referenceId");
