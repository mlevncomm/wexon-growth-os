-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "llmApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN "llmBaseUrl" TEXT NOT NULL DEFAULT 'https://api.groq.com/openai/v1';
ALTER TABLE "AppSettings" ADD COLUMN "llmModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b';
ALTER TABLE "AppSettings" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'groq';
