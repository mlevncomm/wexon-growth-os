-- Supabase SQL Editor: tablolar (Prisma modelleri). Data API kapatılabilir.

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT PRIMARY KEY,
  "query" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NOT NULL DEFAULT '',
  "targetCount" INTEGER NOT NULL,
  "minRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "requirePhone" BOOLEAN NOT NULL DEFAULT true,
  "phonePrefix" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'idle',
  "foundCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT PRIMARY KEY,
  "placeId" TEXT NOT NULL UNIQUE,
  "campaignId" TEXT,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "rating" DOUBLE PRECISION,
  "reviewCount" INTEGER,
  "mapsUrl" TEXT NOT NULL DEFAULT '',
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "district" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'yeni',
  "notes" TEXT NOT NULL DEFAULT '',
  "consented" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OutreachJob" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "templateId" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "error" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutreachJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BrandPlaybook" (
  "id" TEXT PRIMARY KEY,
  "tone" TEXT NOT NULL DEFAULT '',
  "rules" TEXT NOT NULL DEFAULT '',
  "forbidden" TEXT NOT NULL DEFAULT '',
  "offer" TEXT NOT NULL DEFAULT '',
  "cta" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CoachMessage" (
  "id" TEXT PRIMARY KEY,
  "role" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "IgThread" (
  "id" TEXT PRIMARY KEY,
  "igsid" TEXT NOT NULL DEFAULT '',
  "username" TEXT NOT NULL DEFAULT '',
  "lastText" TEXT NOT NULL DEFAULT '',
  "lastAt" TIMESTAMP(3),
  "draft" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "IgMessage" (
  "id" TEXT PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IgMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "IgThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "googlePlacesApiKey" TEXT NOT NULL DEFAULT '',
  "waCloudToken" TEXT NOT NULL DEFAULT '',
  "waPhoneNumberId" TEXT NOT NULL DEFAULT '',
  "delayMinSec" INTEGER NOT NULL DEFAULT 20,
  "delayMaxSec" INTEGER NOT NULL DEFAULT 45,
  "dailyCap" INTEGER NOT NULL DEFAULT 40,
  "queuePaused" BOOLEAN NOT NULL DEFAULT false,
  "queueStopped" BOOLEAN NOT NULL DEFAULT false,
  "llmApiKey" TEXT NOT NULL DEFAULT '',
  "llmBaseUrl" TEXT NOT NULL DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai',
  "llmModel" TEXT NOT NULL DEFAULT 'gemini-3.5-flash',
  "llmProvider" TEXT NOT NULL DEFAULT 'gemini',
  "igAccessToken" TEXT NOT NULL DEFAULT '',
  "igUserId" TEXT NOT NULL DEFAULT '',
  "igWebhookVerifyToken" TEXT NOT NULL DEFAULT ''
);

INSERT INTO "AppSettings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
INSERT INTO "BrandPlaybook" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "OutreachJob_status_scheduledAt_idx" ON "OutreachJob"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");
