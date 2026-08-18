-- CreateTable
CREATE TABLE "BrandPlaybook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tone" TEXT NOT NULL DEFAULT '',
    "rules" TEXT NOT NULL DEFAULT '',
    "forbidden" TEXT NOT NULL DEFAULT '',
    "offer" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IgThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igsid" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "lastText" TEXT NOT NULL DEFAULT '',
    "lastAt" DATETIME,
    "draft" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IgMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "IgThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "OutreachJob" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp';

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "igAccessToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN "igUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN "igWebhookVerifyToken" TEXT NOT NULL DEFAULT '';
