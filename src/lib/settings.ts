import { prisma } from "./prisma";
import { tenantId, tryTenantId } from "./tenant";

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
  __wexonSettings?: Map<string, { at: number; data: Settings }>;
};

const TTL_MS = 15_000;

function cache(): Map<string, { at: number; data: Settings }> {
  if (!g.__wexonSettings) g.__wexonSettings = new Map();
  return g.__wexonSettings;
}

function mapSettings(row: SettingsRow | null): Settings {
  return {
    googlePlacesApiKey:
      row?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || "",
    waCloudToken: row?.waCloudToken || "",
    waPhoneNumberId: row?.waPhoneNumberId || "",
    delayMinSec: row?.delayMinSec ?? 20,
    delayMaxSec: row?.delayMaxSec ?? 45,
    dailyCap: row?.dailyCap ?? 40,
    queuePaused: row?.queuePaused ?? false,
    queueStopped: row?.queueStopped ?? false,
    llmApiKey: row?.llmApiKey || process.env.LLM_API_KEY || process.env.GROQ_API_KEY || "",
    llmBaseUrl: row?.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    llmModel: row?.llmModel || process.env.LLM_MODEL || "openai/gpt-oss-20b",
    llmProvider: row?.llmProvider || "groq",
    igAccessToken: row?.igAccessToken || "",
    igUserId: row?.igUserId || "",
    igWebhookVerifyToken: row?.igWebhookVerifyToken || "",
  };
}

function scopeId(explicit?: string): string {
  return explicit ?? tenantId();
}

export function bustSettingsCache(id?: string) {
  const key = id ?? tryTenantId();
  if (key) cache().delete(key);
  else cache().clear();
}

export async function peekSettings(explicitTenantId?: string): Promise<Settings> {
  const id = scopeId(explicitTenantId);
  const hit = cache().get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const row = await prisma.appSettings.findUnique({ where: { tenantId: id } });
  const data = mapSettings(row);
  cache().set(id, { at: Date.now(), data });
  return data;
}

export async function getSettings(explicitTenantId?: string): Promise<Settings> {
  return peekSettings(explicitTenantId);
}

export async function updateSettings(
  patch: Partial<Settings>,
  explicitTenantId?: string,
): Promise<Settings> {
  const id = scopeId(explicitTenantId);
  await prisma.appSettings.upsert({
    where: { tenantId: id },
    update: patch,
    create: { tenantId: id, ...patch },
  });
  bustSettingsCache(id);
  return peekSettings(id);
}
