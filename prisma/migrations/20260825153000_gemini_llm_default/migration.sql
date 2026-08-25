-- Gemini is the default LLM. Groq rows are remapped; gsk_ keys are cleared.
ALTER TABLE "AppSettings" ALTER COLUMN "llmBaseUrl" SET DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai';
ALTER TABLE "AppSettings" ALTER COLUMN "llmModel" SET DEFAULT 'gemini-2.5-flash';
ALTER TABLE "AppSettings" ALTER COLUMN "llmProvider" SET DEFAULT 'gemini';

UPDATE "AppSettings"
SET
  "llmProvider" = 'gemini',
  "llmBaseUrl" = 'https://generativelanguage.googleapis.com/v1beta/openai',
  "llmModel" = 'gemini-2.5-flash',
  "llmApiKey" = CASE WHEN "llmApiKey" LIKE 'gsk_%' THEN '' ELSE "llmApiKey" END
WHERE "llmProvider" = 'groq' OR "llmBaseUrl" LIKE '%api.groq.com%';
