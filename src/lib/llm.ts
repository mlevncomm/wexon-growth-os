import { copyAngles, generateSalesCopy, type CopyAngle } from "./copy-ai";
import {
  GEMINI_MODEL_FALLBACKS,
  isGeminiEndpoint,
  LLM_PROVIDERS,
} from "./llm-providers";
import { playbookToPrompt, type Playbook } from "./playbook";
import { productLine, type Vertical } from "./verticals";

export { LLM_PROVIDERS } from "./llm-providers";
export type LlmProviderId = (typeof LLM_PROVIDERS)[number]["id"];

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
  error?: { message?: string; failed_generation?: string };
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function wantsJsonMode(model: string): boolean {
  return !/gpt-oss|compound|qwen3|o1|o3|o4/i.test(model);
}

function extractText(json: ChatResponse): string {
  const msg = json.choices?.[0]?.message;
  return [msg?.content, msg?.reasoning, json.error?.failed_generation]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n");
}

function apiErrorMessage(json: unknown, status: number): string {
  if (!json || typeof json !== "object") return `AI hata ${status}`;
  const err = (json as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  if (status === 404) {
    return "Gemini model bulunamadı (404). Sistem’de gemini-3.5-flash kaydedip Kontrol et’e basın.";
  }
  return `AI hata ${status}`;
}

async function chatCompletions(
  url: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
): Promise<ChatResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let json: ChatResponse = {};
  try {
    json = JSON.parse(raw) as ChatResponse;
  } catch {
    throw new Error("AI yanıtı okunamadı");
  }
  if (!res.ok) {
    if (parseCopyJson(extractText(json))) return json;
    throw new Error(apiErrorMessage(json, res.status));
  }
  return json;
}

function llmHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://127.0.0.1:3000";
    headers["X-Title"] = "Wexon Growth OS";
  }
  return headers;
}

function geminiModels(preferred: string): string[] {
  const first = preferred.replace(/^models\//, "").trim() || GEMINI_MODEL_FALLBACKS[0];
  return [...new Set([first, ...GEMINI_MODEL_FALLBACKS])];
}

function extractGeminiText(json: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  promptFeedback?: { blockReason?: string };
}): string {
  const blocked = json.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Gemini güvenlik filtresi: ${blocked}`);
  return (json.candidates ?? [])
    .flatMap((c) => c.content?.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t && t.trim()))
    .join("\n")
    .trim();
}

async function geminiGenerate(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n")
    .trim();
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.6,
    maxOutputTokens: opts.maxTokens ?? 900,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";

  let last = "Gemini yanıt vermedi";
  for (const model of geminiModels(opts.model)) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents.length ? contents : [{ role: "user", parts: [{ text: "OK" }] }],
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig,
      }),
    });
    const raw = await res.text();
    let json: Parameters<typeof extractGeminiText>[0] & { error?: { message?: string } } = {};
    try {
      json = JSON.parse(raw) as typeof json;
    } catch {
      last = "Gemini yanıtı okunamadı";
      continue;
    }
    if (!res.ok) {
      last = apiErrorMessage(json, res.status);
      if (res.status === 404 || /not found|not supported/i.test(last)) continue;
      throw new Error(last);
    }
    const text = extractGeminiText(json);
    if (text) return text;
    last = "Gemini boş yanıt verdi";
  }
  throw new Error(last);
}

export async function llmChat(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  if (isGeminiEndpoint(opts.baseUrl, opts.model, opts.apiKey)) {
    return geminiGenerate(opts);
  }
  const base = opts.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const headers = llmHeaders(opts.apiKey, base);
  const payload: Record<string, unknown> = {
    model: opts.model,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 900,
    messages: opts.messages,
  };
  const useJson = Boolean(opts.json) && wantsJsonMode(opts.model);
  let json: ChatResponse;
  try {
    json = await chatCompletions(url, headers, useJson ? { ...payload, response_format: { type: "json_object" } } : payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!useJson || !/json|response_format/i.test(message)) throw err;
    json = await chatCompletions(url, headers, payload);
  }
  return extractText(json);
}

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parseCopyJson(raw: string): { name: string; body: string } | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const body =
    (typeof parsed.body === "string" ? parsed.body : typeof parsed.mesaj === "string" ? parsed.mesaj : "").trim();
  if (!name || !body) return null;
  return { name, body };
}

export function parseCopyLoose(raw: string): { name: string; body: string } | null {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return null;
  const name =
    text.match(/"name"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] ??
    text.match(/şablon adı\s*[:：]\s*(.+)/i)?.[1]?.trim() ??
    "";
  const bodyMatch =
    text.match(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/i) ??
    text.match(/"mesaj"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  let body = bodyMatch?.[1] ? bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "";
  if (!body && text.includes("{ad}")) {
    body = text
      .split("\n")
      .filter((line) => !/^\s*\{?\s*"?(name|role|reasoning)"?/i.test(line))
      .join(" ")
      .replace(/[{}"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!body.includes("{ad}") && !name) return null;
  if (!body.includes("{ad}")) return null;
  return { name: name || "AI şablon", body };
}

export function sanitizeCopy(input: { name: string; body: string }, angle: CopyAngle, vertical: Vertical = "water") {
  const fallback = generateSalesCopy(angle, vertical);
  let name = input.name.replace(/\s+/g, " ").trim().slice(0, 80) || fallback.name;
  let body = input.body.replace(/\s+\n/g, "\n").trim();
  if (!body) body = fallback.body;
  if (!body.includes("{ad}")) body = `Merhaba {ad}, ${body}`;
  if (!body.includes("{ilçe}") && !body.includes("{il}")) {
    body = body.replace(/\{ad\}/, "{ad}, {ilçe} bölgesinde");
  }
  if (body.length > 900) body = `${body.slice(0, 897).trim()}…`;
  return { name, body };
}

export function copyNeedsRewrite(body: string, playbook?: Playbook): boolean {
  const text = body.trim();
  if (!text.includes("{ad}")) return true;
  if (!text.includes("{ilçe}") && !text.includes("{il}")) return true;
  if (/[!]{3,}/.test(text) || /\b(ucuz|bedava|iys|onayınız|spam)\b/i.test(text)) return true;
  if (text.length > 520) return true;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  if (sentences.length > 5) return true;
  if (playbook?.forbidden) {
    for (const word of playbook.forbidden.split(/[,;\n]/)) {
      const needle = word.trim().toLowerCase();
      if (needle.length > 1 && text.toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

function angleLabel(angle: CopyAngle, vertical: Vertical = "water"): string {
  return copyAngles(vertical).find((a) => a.id === angle)?.label ?? angle;
}

function buildPrompt(angle: CopyAngle, brief: string, playbook?: Playbook, vertical: Vertical = "water"): string {
  const extra = brief.trim() ? `Ek istek: ${brief.trim().slice(0, 400)}` : "";
  const book = playbookToPrompt(playbook ?? { tone: "", rules: "", forbidden: "", offer: "", cta: "" });
  return `WhatsApp B2B satış mesajı yaz. Ürün: ${productLine(vertical)}.
Rakibe yazma. Açı: ${angleLabel(angle, vertical)}.
Türkçe, 2-3 cümle, profesyonel ve nazik. {ad} ve {ilçe} yer tutucuları aynen kalsın.
İYS, onay, izin varmış gibi yazma. Fiyat uydurma. CTA: keşif randevusu veya kısa görüşme.
${book}
${extra}
Çıktı yalnızca JSON:
{"name":"kısa ad","body":"Merhaba {ad}, {ilçe} ..."}`;
}

function rewritePrompt(body: string, playbook?: Playbook): string {
  const book = playbookToPrompt(playbook ?? { tone: "", rules: "", forbidden: "", offer: "", cta: "" });
  return `Aşağıdaki WhatsApp taslağını düzelt. Spam, kaba dil, yasak kelime, İYS/onay iddiası ve kaçmış yer tutucu olmasın.
2-3 cümle, {ad} ve {ilçe} zorunlu.
${book}
Taslak:
${body}
Çıktı yalnızca JSON: {"name":"...","body":"..."}`;
}

export async function generateLlmCopy(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  angle: CopyAngle;
  brief?: string;
  playbook?: Playbook;
  vertical?: Vertical;
}): Promise<{ name: string; body: string }> {
  const vertical = opts.vertical ?? "water";
  const first = await llmChat({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    model: opts.model,
    json: true,
    messages: [
      { role: "system", content: "Cevabın tek bir JSON nesnesi olsun. Başka metin yazma." },
      { role: "user", content: buildPrompt(opts.angle, opts.brief ?? "", opts.playbook, vertical) },
    ],
  });
  let parsed = parseCopyJson(first) ?? parseCopyLoose(first);
  if (!parsed) throw new Error("AI şablon JSON üretmedi");
  let copy = sanitizeCopy(parsed, opts.angle, vertical);
  if (!copyNeedsRewrite(copy.body, opts.playbook)) return copy;

  const second = await llmChat({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    model: opts.model,
    json: true,
    temperature: 0.4,
    messages: [
      { role: "system", content: "Cevabın tek bir JSON nesnesi olsun. Başka metin yazma." },
      { role: "user", content: rewritePrompt(copy.body, opts.playbook) },
    ],
  });
  parsed = parseCopyJson(second) ?? parseCopyLoose(second);
  if (parsed) copy = sanitizeCopy(parsed, opts.angle, vertical);
  return copy;
}

export async function generateLlmReply(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  inbound: string;
  username?: string;
  playbook?: Playbook;
  vertical?: Vertical;
}): Promise<string> {
  const book = playbookToPrompt(opts.playbook ?? { tone: "", rules: "", forbidden: "", offer: "", cta: "" });
  const who = opts.username ? `Gönderen: ${opts.username}` : "";
  const product = productLine(opts.vertical ?? "water");
  const text = await llmChat({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    model: opts.model,
    json: true,
    temperature: 0.5,
    messages: [
      { role: "system", content: "Cevabın tek bir JSON nesnesi olsun. Başka metin yazma." },
      {
        role: "user",
        content: `Instagram DM yanıt taslağı yaz. Ürün: ${product}.
Gelen mesajı nazikçe cevapla; soğuk satış spamı yapma. 2-3 cümle, Türkçe.
İYS/onay iddiası yok. Keşif veya net soru ile bitir.
${book}
${who}
Gelen: ${opts.inbound.slice(0, 800)}
Çıktı: {"body":"..."}`,
      },
    ],
  });
  const parsed = parseJsonObject(text);
  const body = typeof parsed?.body === "string" ? parsed.body.trim() : "";
  if (body) return body.slice(0, 900);
  const fallback = text.replace(/[{}"']/g, " ").replace(/\s+/g, " ").trim();
  return (fallback || "Merhaba, mesajınız için teşekkürler. Uygun bir saatte ihtiyacınızı konuşabilir miyiz?").slice(0, 900);
}

export async function pingLlm(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<void> {
  await llmChat({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    model: opts.model,
    maxTokens: 32,
    messages: [{ role: "user", content: "Sadece OK yaz." }],
  });
}
