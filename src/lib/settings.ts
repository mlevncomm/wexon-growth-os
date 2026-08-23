import { prisma } from "./prisma";

export type Settings = {
  googlePlacesApiKey: string;
  waCloudToken: string;
  waPhoneNumberId: string;
  delayMinSec: number;
  delayMaxSec: number;
  dailyCap: number;
  queuePaused: boolean;
  queueStopped: boolean;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmProvider: string;
  igAccessToken: string;
  igUserId: string;
  igWebhookVerifyToken: string;
};

type SettingsRow = {
  googlePlacesApiKey: string;
  waCloudToken: string;
  waPhoneNumberId: string;
  delayMinSec: number;
  delayMaxSec: number;
  dailyCap: number;
  queuePaused: boolean;
  queueStopped: boolean;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmProvider: string;
  igAccessToken: string;
  igUserId: string;
  igWebhookVerifyToken: string;
};

const g = globalThis as unknown as {
  __wexonSettings?: { at: number; data: Settings };
};

const TTL_MS = 15_000;

function mapSettings(row: SettingsRow | null): Settings {
  return {
    googlePlacesApiKey:
      row?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || "",
    waCloudToken: row?.waCloudToken || process.env.WHATSAPP_CLOUD_TOKEN || "",
    waPhoneNumberId:
      row?.waPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    delayMinSec: row?.delayMinSec ?? 20,
    delayMaxSec: row?.delayMaxSec ?? 45,
    dailyCap: row?.dailyCap ?? 40,
    queuePaused: row?.queuePaused ?? false,
    queueStopped: row?.queueStopped ?? false,
    llmApiKey: row?.llmApiKey || process.env.LLM_API_KEY || process.env.GROQ_API_KEY || "",
    llmBaseUrl: row?.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    llmModel: row?.llmModel || process.env.LLM_MODEL || "openai/gpt-oss-20b",
    llmProvider: row?.llmProvider || "groq",
    igAccessToken: row?.igAccessToken || process.env.IG_ACCESS_TOKEN || "",
    igUserId: row?.igUserId || process.env.IG_USER_ID || "",
    igWebhookVerifyToken: row?.igWebhookVerifyToken || process.env.IG_WEBHOOK_VERIFY_TOKEN || "",
  };
}

export function bustSettingsCache() {
  g.__wexonSettings = undefined;
}

export async function peekSettings(): Promise<Settings> {
  const hit = g.__wexonSettings;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const data = mapSettings(row);
  g.__wexonSettings = { at: Date.now(), data };
  return data;
}

export async function getSettings(): Promise<Settings> {
  return peekSettings();
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: patch,
    create: { id: "default", ...patch },
  });
  bustSettingsCache();
  return peekSettings();
}
