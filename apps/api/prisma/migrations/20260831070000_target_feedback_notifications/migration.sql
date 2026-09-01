DROP INDEX IF EXISTS "Feedback_referenceId_key";
ALTER TABLE "Feedback" DROP COLUMN IF EXISTS "referenceId";

ALTER TABLE "Notification" ADD COLUMN "recipientUserId" TEXT;
CREATE INDEX "Notification_recipientUserId_publishedAt_id_idx"
ON "Notification"("recipientUserId", "publishedAt", "id");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
