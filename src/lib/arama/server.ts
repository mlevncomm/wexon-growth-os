import "server-only";
import { getPlaybook, playbookToPrompt } from "@/lib/playbook";
import { getSettings } from "@/lib/settings";
import { currentTenant } from "@/lib/tenant";
import { productLine, type Vertical } from "@/lib/verticals";
import { BILGI_BANKASI, GENEL_SENARYO, SENARYO } from "./content";
import { CALL_MARK, isOutcome, OUTCOMES, VOICES, type Outcome } from "./shared";

export { CALL_MARK, OUTCOMES, isOutcome, outcomeOf, type Outcome } from "./shared";

/** Doğal ses: düşünür ve aynı anda insan gibi konuşur (tek adım, ~1 sn). */
export const VOICE_MODEL = process.env.ARAMA_SES_MODELI || "openai/gpt-audio-mini";
/** Premium: insan gibi ses ve daha akıllı cevap (görüşme başı ~12–15 sent). Varsayılan. */
export const VOICE_MODEL_PREMIUM = process.env.ARAMA_SES_MODELI_PREMIUM || "openai/gpt-audio";
/** Ücretsiz ses modunda, yedekte ve özetlerde kullanılan ucuz metin modeli. */
export const TEXT_MODEL = process.env.ARAMA_METIN_MODELI || "anthropic/claude-haiku-5.5";
export const FALLBACK_MODEL = process.env.ARAMA_YEDEK_MODEL || "openai/gpt-6-luna";
/** OpenRouter bakiyesi bunun altına düşünce yeni arama isteği gönderilmez. */
const MIN_BALANCE_USD = Number(process.env.ARAMA_MIN_BAKIYE_USD || 0.25);

/** Açmayan işletme en fazla bu kadar denenir. */
export const MAX_ATTEMPTS = 3;
export const callAttempts = (notes: string) => notes.split(CALL_MARK).length - 1;

export async function openRouterKey(): Promise<string> {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const s = await getSettings();
  return s.llmApiKey.startsWith("sk-or-") || s.llmProvider === "openrouter" ? s.llmApiKey : "";
}

const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://wexon.dev",
  "X-Title": "Wexon Growth OS Arama",
});

// Bakiye sorgusu her istekte yapılmasın diye 60 sn önbellek
const g = globalThis as unknown as { __aramaCredits?: { at: number; key: string; remaining: number | null } };
export async function balance(key: string, force = false): Promise<number | null> {
  const c = g.__aramaCredits;
  if (!force && c && c.key === key && Date.now() - c.at < 60_000) return c.remaining;
  let remaining: number | null = null;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/credits", { headers: headers(key), cache: "no-store" });
    const j = (await r.json()) as { data?: { total_credits?: number; total_usage?: number } };
    if (r.ok && j.data) remaining = Number(j.data.total_credits ?? 0) - Number(j.data.total_usage ?? 0);
  } catch {}
  g.__aramaCredits = { at: Date.now(), key, remaining };
  return remaining;
}
export async function budgetError(key: string): Promise<string | null> {
  const left = await balance(key);
  return left != null && left < MIN_BALANCE_USD
    ? `OpenRouter bakiyesi azaldı ($${left.toFixed(2)}). Yeni arama için bakiye yükle.`
    : null;
}

export type LeadContext = { isletme?: string; telefon?: string; sektor?: string; sehir?: string; not?: string };

/** +905550000001 → "0 555 000 00 01" (Ece numarayı bu biçimde okuyup teyit eder). */
function spokenPhone(raw: string | undefined): string {
  const d = String(raw || "").replace(/D/g, "").replace(/^90(?=d{10}$)/, "").replace(/^0/, "");
  return d.length === 10 ? `0 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : "bilinmiyor";
}

const VOICE_RULES = `

SESLİ GÖRÜŞME KURALLARI
- Şu an gerçek bir telefon görüşmesindesin; söylediğin her şey karşı tarafa sesli gidiyor. En fazla iki kısa cümle, sonra sus.
- Sesin: gülümseyen, sıcak, rahat; gerçek bir telefon sohbeti gibi, spiker veya reklam gibi değil. Doğal İstanbul Türkçesi, yabancı aksan yok. Cümle içinde doğal vurgular ve küçük duraklamalar yap; tek düze okuma.
- Telefon hattında anlaşılmak için tane tane konuş; numaraları yavaş söyle.
- Müşterinin sözleri otomatik ses tanımayla yazıya çevriliyor, hatalı olabilir; anlamını tahmin et, hiç anlamazsan kibarca tekrar ettir.
- "(...)" içindeki mesajlar durum bilgisi veya operatör talimatıdır, müşterinin sözü değildir; asla sesli okuma, sadece uygula.
- Asla sessiz kalma.`;
const TEXT_RULES = `${VOICE_RULES}
- Sadece konuşma metni yaz: emoji, madde işareti, yıldız, link, parantez yok.`;

/** Aramayı yapan işletme (tenant): adı, sektörü ve Koç'ta öğretilen kurallar. */
export type Brand = { name: string; vertical: Vertical; playbook: string };

// Playbook her konuşma turunda veritabanından okunmasın diye 60 sn önbellek
const pb = globalThis as unknown as { __aramaPlaybook?: Map<string, { at: number; text: string }> };
export async function currentBrand(): Promise<Brand> {
  const ctx = currentTenant();
  if (!pb.__aramaPlaybook) pb.__aramaPlaybook = new Map();
  const hit = pb.__aramaPlaybook.get(ctx.tenantId);
  let text = hit && Date.now() - hit.at < 60_000 ? hit.text : null;
  if (text == null) {
    text = await getPlaybook().then(playbookToPrompt).catch(() => "");
    pb.__aramaPlaybook.set(ctx.tenantId, { at: Date.now(), text });
  }
  return { name: ctx.tenantName, vertical: ctx.vertical, playbook: text };
}

export function systemPrompt(lead: LeadContext, kind: "voice" | "text", brand: Brand): string {
  const v = (s: string | undefined, fb: string) => (s || "").trim().slice(0, 600) || fb;
  const wexon = brand.vertical === "software";
  const base = (wexon ? SENARYO : GENEL_SENARYO)
    .replaceAll("{firma}", brand.name)
    .replaceAll("{urun}", productLine(brand.vertical))
    .replaceAll("{isletme}", v(lead.isletme, "işletme"))
    .replaceAll("{telefon}", spokenPhone(lead.telefon))
    .replaceAll("{sektor}", v(lead.sektor, "belirtilmemiş"))
    .replaceAll("{sehir}", v(lead.sehir, "belirtilmemiş"))
    .replaceAll("{not}", v(lead.not, "yok"));
  const knowledge = wexon ? "\n\n=== WEXON HAKKINDA BİLMEN GEREKENLER (gerektiğinde kullan) ===\n" + BILGI_BANKASI : "";
  // Koç kuralları WhatsApp için yazıldı; telefonda senaryo önceliklidir
  const playbook = brand.playbook
    ? `\n\n=== KOÇ'TA ÖĞRETİLEN MARKA BİLGİSİ (yazılı mesajlar içindir) ===\nBuradan sadece fiyat/teklif bilgisini, yasak kelimeleri ve genel marka çizgisini al. Telefon akışı, açılış ve ton için yukarıdaki senaryo geçerlidir; çelişirse senaryoya uy.\n${brand.playbook}`
    : "";
  return base + knowledge + playbook + (kind === "voice" ? VOICE_RULES : TEXT_RULES);
}

type Msg = { role: "user" | "assistant"; content: string };
export function cleanMessages(raw: unknown): Msg[] {
  const msgs = (Array.isArray(raw) ? raw : [])
    .filter((m): m is Msg => Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  return msgs.slice(-24); // maliyeti sınırla
}

export function chatBody(opts: { kind: "voice" | "text"; voice: string; premium?: boolean; lead: LeadContext; messages: Msg[]; fallback: boolean; brand: Brand; audio?: string }) {
  const system = systemPrompt(opts.lead, opts.kind, opts.brand);
  if (opts.kind === "voice") {
    // Müşterinin son sözü yazıya çevrilmeden, ses olarak doğrudan modele gider (tonu ve duraksamayı da duyar)
    const heard = opts.audio
      ? [{ role: "user", content: [{ type: "input_audio", input_audio: { data: opts.audio, format: "wav" } }] }]
      : [];
    return {
      model: opts.premium ? VOICE_MODEL_PREMIUM : VOICE_MODEL,
      modalities: ["text", "audio"],
      audio: { voice: VOICES.some((v) => v.value === opts.voice) ? opts.voice : "marin", format: "pcm16" },
      messages: [{ role: "system", content: system }, ...opts.messages, ...heard],
      stream: true,
      max_tokens: 700,
      usage: { include: true },
    };
  }
  const model = opts.fallback ? FALLBACK_MODEL : TEXT_MODEL;
  // Anthropic modellerinde uzun sistem mesajını önbelleğe al → sonraki turlar ~10 kat ucuz
  const sys = model.startsWith("anthropic/")
    ? { role: "system", content: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] }
    : { role: "system", content: system };
  return { model, messages: [sys, ...opts.messages], stream: true, max_tokens: 220, temperature: 0.7, usage: { include: true } };
}

export async function openRouterStream(key: string, body: object, signal: AbortSignal): Promise<Response> {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", signal, headers: headers(key), body: JSON.stringify(body),
  });
}

/** Müşterinin ses kaydını yazıya döker (ekranda göstermek, geçmiş ve telesekreter tespiti için). */
export const STT_MODEL = process.env.ARAMA_YAZI_MODELI || "google/gemini-2.5-flash-lite";
export async function transcribe(key: string, audioB64: string): Promise<{ text: string; maliyet: number }> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: headers(key), signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model: STT_MODEL, temperature: 0, max_tokens: 300, usage: { include: true },
      messages: [{ role: "user", content: [
        { type: "text", text: "Bu bir telefon görüşmesinden kısa bir Türkçe ses kaydı. Söyleneni kelimesi kelimesine yazıya dök. Sadece söylenen metni yaz; açıklama ekleme. Anlaşılır konuşma yoksa sadece - yaz." },
        { type: "input_audio", input_audio: { data: audioB64, format: "wav" } },
      ] }],
    }),
  });
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number }; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message || `Yazıya dökme hatası (${r.status})`);
  const text = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "");
  return { text: text === "-" ? "" : text, maliyet: Number(j.usage?.cost) || 0 };
}

/** Tarayıcıdan gelen WAV (base64) makul boyutta mı? (~45 sn'lik 16 kHz konuşma) */
export const validAudio = (a: unknown): a is string => typeof a === "string" && a.length > 100 && a.length < 2_000_000 && /^[A-Za-z0-9+/=]+$/.test(a.slice(0, 200));

export type Summary = {
  sonuc: Outcome | "";
  whatsapp: string;
  yetkili: string;
  geriArama: string;
  istekler: string;
  ozet: string;
  maliyet: number;
};

/** Görüşme dökümünden sonucu, numarayı ve yetkili adını çıkar (~0,03 sent). */
export async function summarize(key: string, input: { konusma: string; isletme: string; telefon: string; firma: string; wexon: boolean }): Promise<Summary> {
  const prompt = `Aşağıda ${input.firma} adına yapılan bir satış telefon görüşmesinin otomatik dökümü var (ses tanıma hataları olabilir).
Aranan işletme: ${input.isletme || "-"} · aranan numara: ${input.telefon || "-"}

DÖKÜM:
${input.konusma.slice(0, 12000)}

Sadece şu JSON'u döndür, başka hiçbir şey yazma:
{"sonuc": "${OUTCOMES.map((o) => o.value).join('" | "')}",
 "whatsapp": "müşterinin verdiği WhatsApp numarası, rakamlarla 05xxxxxxxxx; 'bu numaraya at' dediyse aranan numara; yoksa boş",
 "yetkili": "görüşülen kişinin adı ve hitabı (örn. Ahmet Bey), bilinmiyorsa boş",
 "geriArama": "geri aranması istendiyse ne zaman, yoksa boş",
 "istekler": "${input.wexon ? "örnek sitede olmasını istedikleri" : "özellikle istedikleri veya sordukları"}, kısa, yoksa boş",
 "ozet": "görüşmenin bir iki cümlelik özeti"}
Sonuç anlamları: ilgilendi = ${input.wexon ? "ücretsiz örneği kabul etti" : "ilgilendi, bilgi gönderilmesini kabul etti"}; ulasilamadi = kimse konuşmadı veya telesekreter; aranmasin = bir daha aranmak istemedi.`;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: headers(key),
    body: JSON.stringify({ model: TEXT_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 400, temperature: 0, usage: { include: true } }),
  });
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number }; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message || `OpenRouter hatası (${r.status})`);
  const txt = j.choices?.[0]?.message?.content || "";
  const out = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)) as Record<string, unknown>;
  const str = (k: string) => (typeof out[k] === "string" ? (out[k] as string).trim() : "");
  const wa = str("whatsapp").replace(/\D/g, "");
  return {
    sonuc: isOutcome(out.sonuc) ? out.sonuc : "",
    whatsapp: /^0?5\d{9}$/.test(wa) ? (wa.length === 10 ? "0" + wa : wa) : "",
    yetkili: str("yetkili"), geriArama: str("geriArama"), istekler: str("istekler"), ozet: str("ozet"),
    maliyet: Number(j.usage?.cost) || 0,
  };
}

// ---------- Netgsm Netsantral: tek tıkla arama (isteğe bağlı) ----------
// Santral önce bilgisayardaki dahiliyi (softphone) çaldırır, açılınca müşteriyi arar.
// Softphone'un hoparlörü = CABLE Input, mikrofonu = CABLE-A Output olmalı (Phone Link ile aynı düzen).
export type NetgsmConfig = { username: string; password: string; internal: string; trunk: string };
export function netgsmConfig(): NetgsmConfig | null {
  const username = process.env.NETGSM_SANTRAL_KULLANICI?.trim();
  const password = process.env.NETGSM_SANTRAL_SIFRE?.trim();
  const internal = process.env.NETGSM_DAHILI?.trim();
  const trunk = process.env.NETGSM_TRUNK?.trim() || username;
  return username && password && internal && trunk ? { username, password, internal, trunk } : null;
}

/** +905321112233 → 5321112233 (Netgsm ulusal biçim, başında 0 yok). */
const netgsmNumber = (e164: string) => e164.replace(/^\+90/, "").replace(/\D/g, "").replace(/^0/, "");

export async function netgsmOriginate(cfg: NetgsmConfig, phoneE164: string, crmId: string) {
  const q = new URLSearchParams({
    username: cfg.username,
    password: cfg.password,
    customer_num: netgsmNumber(phoneE164),
    internal_num: cfg.internal,
    ring_timeout: "25",
    crm_id: crmId.slice(0, 40),
    wait_response: "0",
    originate_order: "if", // önce dahili (bilgisayar) çalar, açılınca müşteri aranır
    trunk: cfg.trunk,
  });
  const r = await fetch(`http://crmsntrl.netgsm.com.tr:9111/${encodeURIComponent(cfg.username)}/originate?${q}`, {
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const text = await r.text();
  let j: { status?: string; message?: string; code?: string; unique_id?: string } = {};
  try { j = JSON.parse(text); } catch { j = { message: text.slice(0, 200) }; }
  if (!r.ok || String(j.status).toLowerCase() !== "success") {
    throw new Error(j.message || `Netgsm hatası (${r.status})`);
  }
  return { uniqueId: j.unique_id ?? "" };
}
