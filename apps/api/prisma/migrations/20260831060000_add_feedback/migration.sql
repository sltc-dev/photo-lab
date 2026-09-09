CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FEATURE', 'OTHER');

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Feedback_referenceId_key" ON "Feedback"("referenceId");
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
