-- Multi-tenant: Tenant / User / AuditLog + tenantId on business tables.
-- Existing rows go to Aquails. Places/LLM copied to all three; WhatsApp/IG stay on Aquails.

CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Tenant" ("id", "slug", "name", "vertical", "active", "createdAt", "updatedAt")
VALUES
  ('tnt_aquails', 'aquails', 'Aquails', 'water', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tnt_wexon_dev', 'wexon-dev', 'Wexon.dev', 'software', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tnt_akarsu', 'akarsu-akademi', 'Akarsu Akademi', 'yks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Campaign" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Lead" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Template" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "Template" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "OutreachJob" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "OutreachJob" AS j
SET "tenantId" = l."tenantId"
FROM "Lead" AS l
WHERE j."leadId" = l."id" AND j."tenantId" IS NULL;
UPDATE "OutreachJob" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "OutreachJob" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "CoachMessage" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "CoachMessage" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "CoachMessage" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "IgThread" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "IgThread" SET "tenantId" = 'tnt_aquails' WHERE "tenantId" IS NULL;
ALTER TABLE "IgThread" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "IgThread" ADD COLUMN IF NOT EXISTS "igsid" TEXT NOT NULL DEFAULT '';
UPDATE "IgThread" SET "igsid" = "id" WHERE "igsid" = '';

-- AppSettings: PK becomes tenantId
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "AppSettings" SET "tenantId" = 'tnt_aquails' WHERE "id" = 'default' OR "tenantId" IS NULL;

CREATE TABLE IF NOT EXISTS "AppSettings_new" (
    "tenantId" TEXT NOT NULL,
    "googlePlacesApiKey" TEXT NOT NULL DEFAULT '',
    "waCloudToken" TEXT NOT NULL DEFAULT '',
    "waPhoneNumberId" TEXT NOT NULL DEFAULT '',
    "delayMinSec" INTEGER NOT NULL DEFAULT 20,
    "delayMaxSec" INTEGER NOT NULL DEFAULT 45,
    "dailyCap" INTEGER NOT NULL DEFAULT 40,
    "queuePaused" BOOLEAN NOT NULL DEFAULT false,
    "queueStopped" BOOLEAN NOT NULL DEFAULT false,
    "llmApiKey" TEXT NOT NULL DEFAULT '',
    "llmBaseUrl" TEXT NOT NULL DEFAULT 'https://api.groq.com/openai/v1',
    "llmModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b',
    "llmProvider" TEXT NOT NULL DEFAULT 'groq',
    "igAccessToken" TEXT NOT NULL DEFAULT '',
    "igUserId" TEXT NOT NULL DEFAULT '',
    "igWebhookVerifyToken" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AppSettings_new_pkey" PRIMARY KEY ("tenantId")
);

INSERT INTO "AppSettings_new" (
  "tenantId", "googlePlacesApiKey", "waCloudToken", "waPhoneNumberId",
  "delayMinSec", "delayMaxSec", "dailyCap", "queuePaused", "queueStopped",
  "llmApiKey", "llmBaseUrl", "llmModel", "llmProvider",
  "igAccessToken", "igUserId", "igWebhookVerifyToken"
)
SELECT
  COALESCE("tenantId", 'tnt_aquails'),
  "googlePlacesApiKey", "waCloudToken", "waPhoneNumberId",
  "delayMinSec", "delayMaxSec", "dailyCap", "queuePaused", "queueStopped",
  "llmApiKey", "llmBaseUrl", "llmModel", "llmProvider",
  "igAccessToken", "igUserId", "igWebhookVerifyToken"
FROM "AppSettings"
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "AppSettings_new" ("tenantId", "googlePlacesApiKey", "llmApiKey", "llmBaseUrl", "llmModel", "llmProvider")
SELECT 'tnt_wexon_dev', s."googlePlacesApiKey", s."llmApiKey", s."llmBaseUrl", s."llmModel", s."llmProvider"
FROM "AppSettings_new" s
WHERE s."tenantId" = 'tnt_aquails'
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "AppSettings_new" ("tenantId", "googlePlacesApiKey", "llmApiKey", "llmBaseUrl", "llmModel", "llmProvider")
SELECT 'tnt_akarsu', s."googlePlacesApiKey", s."llmApiKey", s."llmBaseUrl", s."llmModel", s."llmProvider"
FROM "AppSettings_new" s
WHERE s."tenantId" = 'tnt_aquails'
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "AppSettings_new" ("tenantId")
VALUES ('tnt_aquails'), ('tnt_wexon_dev'), ('tnt_akarsu')
ON CONFLICT ("tenantId") DO NOTHING;

DROP TABLE "AppSettings";
ALTER TABLE "AppSettings_new" RENAME TO "AppSettings";
ALTER TABLE "AppSettings" RENAME CONSTRAINT "AppSettings_new_pkey" TO "AppSettings_pkey";

-- BrandPlaybook: PK becomes tenantId
ALTER TABLE "BrandPlaybook" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "BrandPlaybook" SET "tenantId" = 'tnt_aquails' WHERE "id" = 'default' OR "tenantId" IS NULL;

CREATE TABLE IF NOT EXISTS "BrandPlaybook_new" (
    "tenantId" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT '',
    "rules" TEXT NOT NULL DEFAULT '',
    "forbidden" TEXT NOT NULL DEFAULT '',
    "offer" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandPlaybook_new_pkey" PRIMARY KEY ("tenantId")
);

INSERT INTO "BrandPlaybook_new" ("tenantId", "tone", "rules", "forbidden", "offer", "cta", "updatedAt")
SELECT COALESCE("tenantId", 'tnt_aquails'), "tone", "rules", "forbidden", "offer", "cta", "updatedAt"
FROM "BrandPlaybook"
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "BrandPlaybook_new" ("tenantId")
VALUES ('tnt_aquails'), ('tnt_wexon_dev'), ('tnt_akarsu')
ON CONFLICT ("tenantId") DO NOTHING;

DROP TABLE "BrandPlaybook";
ALTER TABLE "BrandPlaybook_new" RENAME TO "BrandPlaybook";
ALTER TABLE "BrandPlaybook" RENAME CONSTRAINT "BrandPlaybook_new_pkey" TO "BrandPlaybook_pkey";

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_placeId_key";
DROP INDEX IF EXISTS "Lead_placeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_tenantId_placeId_key" ON "Lead"("tenantId", "placeId");
CREATE UNIQUE INDEX IF NOT EXISTS "IgThread_tenantId_igsid_key" ON "IgThread"("tenantId", "igsid");
CREATE INDEX IF NOT EXISTS "Campaign_tenantId_createdAt_idx" ON "Campaign"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Template_tenantId_name_idx" ON "Template"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "OutreachJob_tenantId_status_scheduledAt_idx" ON "OutreachJob"("tenantId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "CoachMessage_tenantId_createdAt_idx" ON "CoachMessage"("tenantId", "createdAt");

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_tenantId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_tenantId_fkey";
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_tenantId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_tenantId_fkey";
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachJob" DROP CONSTRAINT IF EXISTS "OutreachJob_tenantId_fkey";
ALTER TABLE "OutreachJob" ADD CONSTRAINT "OutreachJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachMessage" DROP CONSTRAINT IF EXISTS "CoachMessage_tenantId_fkey";
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgThread" DROP CONSTRAINT IF EXISTS "IgThread_tenantId_fkey";
ALTER TABLE "IgThread" ADD CONSTRAINT "IgThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSettings" DROP CONSTRAINT IF EXISTS "AppSettings_tenantId_fkey";
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandPlaybook" DROP CONSTRAINT IF EXISTS "BrandPlaybook_tenantId_fkey";
ALTER TABLE "BrandPlaybook" ADD CONSTRAINT "BrandPlaybook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Tenant", "User", "AuditLog", "Campaign", "Lead", "Template", "OutreachJob", "BrandPlaybook", "CoachMessage", "IgThread", "IgMessage", "AppSettings" TO wexon_app;
  END IF;
END $$;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrandPlaybook" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    DROP POLICY IF EXISTS "wexon_app_all" ON "Tenant";
    CREATE POLICY "wexon_app_all" ON "Tenant" FOR ALL TO wexon_app USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "wexon_app_all" ON "User";
    CREATE POLICY "wexon_app_all" ON "User" FOR ALL TO wexon_app USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "wexon_app_all" ON "AuditLog";
    CREATE POLICY "wexon_app_all" ON "AuditLog" FOR ALL TO wexon_app USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "wexon_app_all" ON "AppSettings";
    CREATE POLICY "wexon_app_all" ON "AppSettings" FOR ALL TO wexon_app USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "wexon_app_all" ON "BrandPlaybook";
    CREATE POLICY "wexon_app_all" ON "BrandPlaybook" FOR ALL TO wexon_app USING (true) WITH CHECK (true);
  END IF;
END $$;
