"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChipStrip } from "@/components/ChipStrip";
import { ConnectGuide } from "@/components/ConnectGuide";
import { useToast } from "@/components/Toast";
import { DEFAULT_LLM, LLM_PROVIDERS, normalizeLlmConfig } from "@/lib/llm-providers";

type Settings = {
  googlePlacesApiKey: string;
  waCloudToken: string;
  waPhoneNumberId: string;
  delayMinSec: number;
  delayMaxSec: number;
  dailyCap: number;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmProvider: string;
  igAccessToken: string;
  igUserId: string;
  igWebhookVerifyToken: string;
  hasPlacesKey: boolean;
  hasCloudToken: boolean;
  hasLlmKey: boolean;
  hasIgToken: boolean;
  hasIgUserId: boolean;
  hosted?: boolean;
  appUrl?: string;
  instagramWebhookUrl?: string;
  postgres?: boolean;
  authConfigured?: boolean;
};

type SettingsForm = Pick<
  Settings,
  | "googlePlacesApiKey"
  | "waCloudToken"
  | "waPhoneNumberId"
  | "delayMinSec"
  | "delayMaxSec"
  | "dailyCap"
  | "llmApiKey"
  | "llmBaseUrl"
  | "llmModel"
  | "llmProvider"
  | "igAccessToken"
  | "igUserId"
  | "igWebhookVerifyToken"
>;

export default function AyarlarPage() {
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>({
    googlePlacesApiKey: "",
    waCloudToken: "",
    waPhoneNumberId: "",
    delayMinSec: 20,
    delayMaxSec: 45,
    dailyCap: 40,
    llmApiKey: "",
    llmBaseUrl: DEFAULT_LLM.baseUrl,
    llmModel: DEFAULT_LLM.model,
    llmProvider: DEFAULT_LLM.id,
    igAccessToken: "",
    igUserId: "",
    igWebhookVerifyToken: "",
  });
  const [flags, setFlags] = useState({
    hasPlacesKey: false,
    hasCloudToken: false,
    hasLlmKey: false,
    hasIgToken: false,
    hasIgUserId: false,
  });
  const [deploy, setDeploy] = useState({
    hosted: false,
    appUrl: "http://127.0.0.1:3000",
    instagramWebhookUrl: "http://127.0.0.1:3000/api/instagram/webhook",
    postgres: false,
    authConfigured: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmCheck, setLlmCheck] = useState<"idle" | "ok" | "bad">("idle");
  const [llmCheckMsg, setLlmCheckMsg] = useState("");

  useEffect(() => {
    const boot = window.setTimeout(() => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((s: Settings) => {
          const llm = normalizeLlmConfig({
            llmApiKey: s.llmApiKey ?? "",
            llmBaseUrl: s.llmBaseUrl,
            llmModel: s.llmModel,
            llmProvider: s.llmProvider,
          });
          setForm({
            googlePlacesApiKey: s.googlePlacesApiKey,
            waCloudToken: s.waCloudToken,
            waPhoneNumberId: s.waPhoneNumberId,
            delayMinSec: s.delayMinSec,
            delayMaxSec: s.delayMaxSec,
            dailyCap: s.dailyCap,
            ...llm,
            igAccessToken: s.igAccessToken ?? "",
            igUserId: s.igUserId ?? "",
            igWebhookVerifyToken: s.igWebhookVerifyToken ?? "",
          });
          setFlags({
            hasPlacesKey: s.hasPlacesKey,
            hasCloudToken: s.hasCloudToken,
            hasLlmKey: s.hasLlmKey,
            hasIgToken: s.hasIgToken,
            hasIgUserId: s.hasIgUserId,
          });
          setDeploy({
            hosted: Boolean(s.hosted),
            appUrl: s.appUrl || "http://127.0.0.1:3000",
            instagramWebhookUrl: s.instagramWebhookUrl || "",
            postgres: Boolean(s.postgres),
            authConfigured: Boolean(s.authConfigured),
          });
          setLoading(false);
        })
        .catch(() => {
          setError("Ayarlar okunamadı");
          setLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(boot);
  }, []);

  function applyProvider(id: string) {
    const preset = LLM_PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      llmProvider: preset.id,
      llmBaseUrl: preset.baseUrl,
      llmModel: preset.model,
    }));
  }

  async function save() {
    setError("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Kaydedilemedi");
      toast.push("Ayarlar kaydedilemedi", "bad");
      return false;
    }
    toast.push("Ayarlar kaydedildi");
    setFlags({
      hasPlacesKey: json.hasPlacesKey,
      hasCloudToken: json.hasCloudToken,
      hasLlmKey: json.hasLlmKey,
      hasIgToken: json.hasIgToken,
      hasIgUserId: json.hasIgUserId,
    });
    if (typeof json.llmApiKey === "string") {
      setForm((prev) => ({ ...prev, llmApiKey: json.llmApiKey }));
    }
    if (typeof json.igAccessToken === "string") {
      setForm((prev) => ({ ...prev, igAccessToken: json.igAccessToken }));
    }
    if (typeof json.igWebhookVerifyToken === "string") {
      setForm((prev) => ({ ...prev, igWebhookVerifyToken: json.igWebhookVerifyToken }));
    }
    return true;
  }

  async function testLlm() {
    setLlmBusy(true);
    setLlmCheck("idle");
    setLlmCheckMsg("");
    try {
      const saved = await save();
      if (!saved) return;
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gemini yanıt vermedi");
      setLlmCheck("ok");
      setLlmCheckMsg("Gemini bağlandı. Koç ve mesaj şablonları bu anahtarı kullanır.");
      toast.push("Gemini çalışıyor");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gemini bağlanamadı";
      setLlmCheck("bad");
      setLlmCheckMsg(message);
      toast.push(message, "bad");
    } finally {
      setLlmBusy(false);
    }
  }

  const provider = LLM_PROVIDERS.find((p) => p.id === form.llmProvider) ?? LLM_PROVIDERS[0];

  return (
    <div>
      <div className="page-kicker">Sistem</div>
      <h1 className="page-title">Anahtarlar ve tavan</h1>
      <p className="page-copy">
        Her işletme kendi anahtarını buraya yazar; Aquails, Wexon.dev ve Akarsu karışmaz. Aşağıdaki kılavuzdan alın, yapıştırın, kaydedin. Maskeli alanı değiştirmezseniz eski sır korunur.
      </p>

      {error ? <p className="error-box" style={{ marginTop: 16 }}>{error}</p> : null}

      {loading ? (
        <div className="settings-grid">
          <div className="card panel"><div className="skel" style={{ height: 280 }} /></div>
          <div className="card panel"><div className="skel" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
        <div style={{ marginBottom: 14 }}>
          <ConnectGuide
            id="anahtar-kilavuzu"
            kicker="Kılavuz"
            title="Kendi anahtarınızı alın"
            note="Wexon size Gemini, Places veya WhatsApp vermez. Google / Meta hesabınızdan ücretsiz veya kendi kotanızla alın. Başka işletmenin anahtarını yapıştırmayın."
            steps={[
              {
                title: "Google Gemini (Koç ve metin)",
                body: "Google hesabıyla AI Studio’ya girin. Create API key → anahtarı kopyalayın (AIza…). Bu sayfada Google Gemini alanına yapıştırıp kaydedin, sonra Kontrol et’e basın. Kart istemez; ücretsiz kota vardır.",
                href: "https://aistudio.google.com/apikey",
                linkLabel: "AI Studio’da anahtar al",
              },
              {
                title: "Google Places (Keşif)",
                body: "Google Cloud Console’da proje açın. Places API (New) ve Places API’yi etkinleştirin. Credentials → API key. AIza… anahtarını yukarıdaki Google Places alanına yazın. Anahtar yetmez: iki API de açık olmalı.",
                href: "https://console.cloud.google.com/apis/library/places.googleapis.com",
                linkLabel: "Places API’yi aç",
              },
              {
                title: "WhatsApp Cloud (canlı gönderim)",
                body: "Meta Business’ta kendi şirket sayfanız ve WhatsApp Business Platform (Cloud API) gerekir. Sistem kullanıcısından kalıcı token + Phone number ID (numaranın kendisi değil) alın. Bu hesaba özeldir; Vercel’de QR çalışmaz.",
                href: "https://business.facebook.com",
                linkLabel: "Meta Business’ı aç",
              },
              {
                title: "Instagram (gelen DM)",
                body: "Kişisel şifre yok. Instagram Professional + Meta uygulama token ve user ID. Webhook için canlı HTTPS şart.",
                href: "https://developers.facebook.com",
                linkLabel: "Meta Developers",
              },
            ]}
          />
        </div>
        <div className="settings-grid">
          <section className="card panel">
            <div className="panel-head">
              <div>
                <div className="page-kicker">Bağlantı</div>
                <h2>API anahtarları</h2>
              </div>
            </div>
            <p className="panel-note">
              Places keşif için zorunlu. Anahtar yetmez: Google Cloud’da Places API (New) ve Places API’yi açın. WhatsApp Cloud canlıda zorunlu; yerelde yoksa QR yedek kalır.
            </p>
            <div className="key-stack">
              <div className="key-block">
                <label className="field">
                  <span>
                    Google Places
                    <span className={`pill ${flags.hasPlacesKey ? "ok" : "warn"}`}>
                      {flags.hasPlacesKey ? "Kayıtlı" : "Eksik"}
                    </span>
                  </span>
                  <input
                    value={form.googlePlacesApiKey}
                    onChange={(e) => setForm({ ...form, googlePlacesApiKey: e.target.value })}
                    placeholder="AIza..."
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="key-block">
                <label className="field">
                  <span>
                    WhatsApp Cloud token
                    <span className={`pill ${flags.hasCloudToken ? "ok" : deploy.hosted ? "warn" : "mute"}`}>
                      {flags.hasCloudToken ? "Kayıtlı" : deploy.hosted ? "Canlıda zorunlu" : "İsteğe bağlı"}
                    </span>
                  </span>
                  <input
                    value={form.waCloudToken}
                    onChange={(e) => setForm({ ...form, waCloudToken: e.target.value })}
                    placeholder="Boş bırakılırsa QR"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="key-block">
                <label className="field">
                  <span>WhatsApp phone number ID</span>
                  <input
                    value={form.waPhoneNumberId}
                    onChange={(e) => setForm({ ...form, waPhoneNumberId: e.target.value })}
                    placeholder="Cloud kullanıyorsanız"
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
            <div className="save-row">
              <button className="btn btn-wexon" type="button" onClick={() => void save()}>
                Ayarları kaydet
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                Maskeli alanı değiştirmezseniz eski değer korunur.
              </span>
            </div>
          </section>

          <section className="card panel">
            <div className="panel-head">
              <div>
                <div className="page-kicker">Gönderim</div>
                <h2>Tavan ve tempo</h2>
              </div>
            </div>
            <p className="panel-note">
              Günlük tavan ve mesaj aralığı spam gibi görünmeyi keser. İYS onayı sizin sorumluluğunuzdadır.
            </p>
            <div className="cap-tiles">
              <label className="cap-tile">
                <span>Min gecikme</span>
                <input
                  type="number"
                  min={8}
                  value={form.delayMinSec}
                  onChange={(e) => setForm({ ...form, delayMinSec: Number(e.target.value) })}
                />
                <em>saniye</em>
              </label>
              <label className="cap-tile">
                <span>Max gecikme</span>
                <input
                  type="number"
                  min={8}
                  value={form.delayMaxSec}
                  onChange={(e) => setForm({ ...form, delayMaxSec: Number(e.target.value) })}
                />
                <em>saniye</em>
              </label>
              <label className="cap-tile">
                <span>Günlük tavan</span>
                <input
                  type="number"
                  min={1}
                  value={form.dailyCap}
                  onChange={(e) => setForm({ ...form, dailyCap: Number(e.target.value) })}
                />
                <em>mesaj / gün</em>
              </label>
            </div>
          </section>
        </div>

        <section className="card panel" style={{ marginTop: 14 }}>
          <div className="panel-head">
            <div>
              <div className="page-kicker">Yapay zeka</div>
              <h2>Google Gemini</h2>
            </div>
            <span className={`pill ${flags.hasLlmKey ? "ok" : "mute"}`}>
              {flags.hasLlmKey ? "Kayıtlı" : "Anahtar yok"}
            </span>
          </div>
          <p className="panel-note">
            Koç ve akıllı metin Google Gemini kullanır. Anahtarı{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>{" "}
            adresinden alın (AIza…). Anahtar yoksa Mesaj ekranı hazır metinle çalışır.
          </p>
          <div className="field">
            <span>Sağlayıcı</span>
            <ChipStrip>
              {LLM_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${form.llmProvider === p.id ? " on" : ""}`}
                  onClick={() => applyProvider(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </ChipStrip>
            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{provider.hint}</div>
          </div>
          <div className="key-stack" style={{ marginTop: 14 }}>
            <div className="key-block">
              <label className="field">
                <span>Google Gemini anahtarı</span>
                <input
                  value={form.llmApiKey}
                  onChange={(e) => {
                    setLlmCheck("idle");
                    setLlmCheckMsg("");
                    setForm({ ...form, llmApiKey: e.target.value });
                  }}
                  placeholder="AIza…"
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="key-block">
              <label className="field">
                <span>Base URL</span>
                <input
                  value={form.llmBaseUrl}
                  onChange={(e) => setForm({ ...form, llmBaseUrl: e.target.value, llmProvider: "custom" })}
                  placeholder={DEFAULT_LLM.baseUrl}
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="key-block">
              <label className="field">
                <span>Model</span>
                <input
                  value={form.llmModel}
                  onChange={(e) => setForm({ ...form, llmModel: e.target.value })}
                  placeholder={DEFAULT_LLM.model}
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
          <div className="save-row">
            <button className="btn btn-wexon" type="button" onClick={() => void save()}>
              Gemini’yi kaydet
            </button>
          </div>
          {flags.hasLlmKey || form.llmApiKey.trim().length > 8 ? (
            <div className="key-block" style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Kontrol et
              </div>
              <p className="panel-note" style={{ marginTop: 6 }}>
                Kaydettikten sonra Google’a kısa bir ping atar. Koç ancak bu geçince yazar.
              </p>
              <div className="save-row" style={{ marginTop: 10 }}>
                <button className="btn btn-wexon" type="button" disabled={llmBusy} onClick={() => void testLlm()}>
                  {llmBusy ? "Kontrol ediliyor…" : "Kontrol et"}
                </button>
                {llmCheck === "ok" ? <span className="pill ok">Çalışıyor</span> : null}
                {llmCheck === "bad" ? <span className="pill bad">Hata</span> : null}
              </div>
              {llmCheckMsg ? (
                <p className={llmCheck === "bad" ? "error-box" : "panel-note"} style={{ marginTop: 10 }}>
                  {llmCheckMsg}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="panel-note" style={{ marginTop: 12 }}>
              Anahtarı yapıştırıp kaydedin. Kontrol et alanı ondan sonra açılır.
            </p>
          )}
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <div className="panel-head">
            <div>
              <div className="page-kicker">Instagram</div>
              <h2>Business Graph API</h2>
            </div>
            <span className={`pill ${flags.hasIgToken && flags.hasIgUserId ? "ok" : "mute"}`}>
              {flags.hasIgToken && flags.hasIgUserId ? "Bağlı" : "Resmi hesap"}
            </span>
          </div>
          <p className="panel-note">
            Kişisel giriş yok. Meta Business + Instagram Professional token gerekir. Gelen DM taslağı playbook ile yazılır; siz onaylayınca gider. Webhook için Cloudflare Tunnel veya canlı HTTPS şart — 127.0.0.1 yetmez.
          </p>
          <div className="key-stack">
            <div className="key-block">
              <label className="field">
                <span>
                  Access token
                  <span className={`pill ${flags.hasIgToken ? "ok" : "mute"}`}>
                    {flags.hasIgToken ? "Kayıtlı" : "Eksik"}
                  </span>
                </span>
                <input
                  value={form.igAccessToken}
                  onChange={(e) => setForm({ ...form, igAccessToken: e.target.value })}
                  placeholder="EAAG..."
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="key-block">
              <label className="field">
                <span>
                  Instagram user ID
                  <span className={`pill ${flags.hasIgUserId ? "ok" : "mute"}`}>
                    {flags.hasIgUserId ? "Var" : "Eksik"}
                  </span>
                </span>
                <input
                  value={form.igUserId}
                  onChange={(e) => setForm({ ...form, igUserId: e.target.value })}
                  placeholder="IG kullanıcı ID"
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="key-block">
              <label className="field">
                <span>Webhook verify token (2. adım)</span>
                <input
                  value={form.igWebhookVerifyToken}
                  onChange={(e) => setForm({ ...form, igWebhookVerifyToken: e.target.value })}
                  placeholder="Meta’ya yazacağınız rastgele sözcük"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
          <div className="save-row">
            <button className="btn btn-wexon" type="button" onClick={() => void save()}>
              Instagram’ı kaydet
            </button>
            <Link className="btn btn-ghost" href="/instagram">
              Gelen DM
            </Link>
            <span className="muted" style={{ fontSize: 13 }}>/api/instagram/webhook</span>
          </div>
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <div className="panel-head">
            <div>
              <div className="page-kicker">Yayın</div>
              <h2>Vercel + Supabase</h2>
            </div>
            <span className={`pill ${deploy.hosted ? "ok" : "mute"}`}>
              {deploy.hosted ? "Vercel" : "Yerel"}
            </span>
          </div>
          <p className="panel-note">
            Canlı veritabanı Supabase Postgres’tir. WhatsApp QR oturumu da bu veritabanına yazılır.
            {deploy.authConfigured ? " Admin girişi tanımlı." : " Admin için AUTH_SECRET + e-posta + şifre yazın."}
          </p>
        </section>
        <div style={{ marginTop: 14 }}>
          <ConnectGuide
            kicker="Yayınlayan için"
            title="Sunucu env (ortak anahtar değil)"
            copyValue={deploy.instagramWebhookUrl}
            steps={[
              {
                title: "Supabase Postgres",
                body: "Yeni proje açın. Connect → Transaction pooler (6543) = DATABASE_URL, sonuna ?pgbouncer=true&connection_limit=1 ekleyin. Session/direct (5432) = DIRECT_URL. prisma/schema.postgres.prisma içeriğini schema.prisma’ya alın (provider postgresql). prisma/supabase-init.sql ve prisma/supabase-rls.sql dosyalarını SQL Editor’de çalıştırın. Data API’yi kapatabilirsiniz; uygulama Prisma kullanır.",
              },
              {
                title: "Vercel env",
                body: `Yalnızca sunucu sırları: DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL, CRON_SECRET. Gemini, Places, WhatsApp ve Instagram anahtarlarını buraya yazmayın — her işletme Sistem ekranına kendi anahtarını yapıştırır. APP_URL = ${deploy.appUrl || "https://projeniz.vercel.app"}`,
              },
              {
                title: "Admin girişi",
                body: deploy.authConfigured
                  ? "AUTH_SECRET ve admin e-posta/şifre tanımlı. Canlıda da aynı üç değişkeni verin. Adres: /giris"
                  : "Yerelde .env içine AUTH_SECRET (min 16 karakter), ADMIN_EMAIL, ADMIN_PASSWORD yazıp sunucuyu yeniden başlatın. Vercel’e de aynılarını ekleyin. Giriş: /giris",
              },
              {
                title: "Kron kuyruk",
                body: "vercel.json her dakika /api/outreach/tick çağırır. CRON_SECRET, Authorization: Bearer ile aynı olsun. Vercel Hobby’de cron günde bir kezdir; dakikalık kuyruk için Pro veya harici cron gerekir. Cloud token yoksa canlı WhatsApp gönderimi olmaz.",
              },
            ]}
          />
        </div>
        </>
      )}
    </div>
  );
}
