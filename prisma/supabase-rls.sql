-- Prisma connection string (postgres rolü) RLS’i atlar. Data API (anon) kapalı kalır.

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutreachJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrandPlaybook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IgThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IgMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Campaign", "Lead", "Template", "OutreachJob", "BrandPlaybook", "CoachMessage", "IgThread", "IgMessage", "AppSettings" FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO postgres;
