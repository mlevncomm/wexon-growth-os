ALTER TABLE "AppSettings" ALTER COLUMN "llmModel" SET DEFAULT 'gemini-3.5-flash';

UPDATE "AppSettings"
SET "llmModel" = 'gemini-3.5-flash'
WHERE "llmModel" IN ('gemini-2.5-flash', 'openai/gpt-oss-20b');
