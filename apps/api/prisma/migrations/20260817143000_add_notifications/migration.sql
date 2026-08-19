CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'VERSION_UPGRADE');
CREATE TYPE "NotificationLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "level" "NotificationLevel" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetVersion" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationReceipt" (
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("userId", "notificationId")
);

CREATE INDEX "Notification_publishedAt_id_idx" ON "Notification"("publishedAt", "id");
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");
CREATE INDEX "NotificationReceipt_notificationId_idx" ON "NotificationReceipt"("notificationId");

ALTER TABLE "NotificationReceipt"
ADD CONSTRAINT "NotificationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReceipt"
ADD CONSTRAINT "NotificationReceipt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
