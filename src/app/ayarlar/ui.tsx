"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChipStrip } from "@/components/ChipStrip";
import { ConnectGuide } from "@/components/ConnectGuide";
import { useToast } from "@/components/Toast";
import { LLM_PROVIDERS } from "@/lib/llm";

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

export default function AyarlarPage() {
  const toast = useToast();
  const [form, setForm] = useState({
    googlePlacesApiKey: "",
    waCloudToken: "",
    waPhoneNumberId: "",
    delayMinSec: 20,
    delayMaxSec: 45,
    dailyCap: 40,
    llmApiKey: "",
    llmBaseUrl: "https://api.groq.com/openai/v1",
    llmModel: "openai/gpt-oss-20b",
    llmProvider: "groq",
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
  const [loading, setLoading] = useState(true);
  const [llmBusy, setLlmBusy] = useState(false);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((s: Settings) => {
          setForm({
            googlePlacesApiKey: s.googlePlacesApiKey,
            waCloudToken: s.waCloudToken,
            waPhoneNumberId: s.waPhoneNumberId,
            delayMinSec: s.delayMinSec,
            delayMaxSec: s.delayMaxSec,
            dailyCap: s.dailyCap,
            llmApiKey: s.llmApiKey ?? "",
            llmBaseUrl: s.llmBaseUrl || "https://api.groq.com/openai/v1",
            llmModel: s.llmModel || "openai/gpt-oss-20b",
            llmProvider: s.llmProvider || "groq",
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
    try {
      const saved = await save();
      if (!saved) return;
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bağlantı yok");
      toast.push("AI bağlandı, şablon üretebilir");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "AI bağlanamadı", "bad");
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
        Yerelde anahtarlar bu makinede (SQLite) durur. Vercel’de Sistem kaydı Supabase Postgres’e yazılır; isterseniz aynı değerleri Vercel env’e de koyabilirsiniz.
      </p>

      {error ? <p className="error-box" style={{ marginTop: 16 }}>{error}</p> : null}

      {loading ? (
        <div className="settings-grid">
          <div className="card panel"><div className="skel" style={{ height: 280 }} /></div>
          <div className="card panel"><div className="skel" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
        <div className="settings-grid">
          <section className="card panel">
            <div className="panel-head">
              <div>
                <div className="page-kicker">Bağlantı</div>
                <h2>API anahtarları</h2>
              </div>
            </div>
            <p className="panel-note">
              Places keşif için zorunlu. WhatsApp Cloud token canlıda (Vercel) zorunlu; yerelde yoksa QR yedek kalır.
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
              <h2>Mesaj şablonu motoru</h2>
            </div>
            <span className={`pill ${flags.hasLlmKey ? "ok" : "mute"}`}>
              {flags.hasLlmKey ? "Bağlı" : "Hazır metin"}
            </span>
          </div>
          <p className="panel-note">
            Ücretsiz için Groq önerilir. OpenAI, Gemini veya OpenRouter da olur; hepsi OpenAI uyumlu uç kullanır. Anahtar yoksa açı seçince hazır metin gelir.
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
                <span>API anahtarı</span>
                <input
                  value={form.llmApiKey}
                  onChange={(e) => setForm({ ...form, llmApiKey: e.target.value })}
                  placeholder="gsk_… / sk-… / AIza…"
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
                  placeholder="https://api.groq.com/openai/v1"
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
                  placeholder="openai/gpt-oss-20b"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
          <div className="save-row">
            <button className="btn btn-wexon" type="button" onClick={() => void save()}>
              AI ayarını kaydet
            </button>
            <button className="btn btn-ghost" type="button" disabled={llmBusy} onClick={() => void testLlm()}>
              {llmBusy ? "Deniyor…" : "Bağlantıyı dene"}
            </button>
          </div>
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
            SQLite bu makinededir. Canlıya çıkınca Postgres (Supabase) şart. Vercel’de WhatsApp QR ve dosya veritabanı çalışmaz.
            {deploy.authConfigured ? " Admin girişi tanımlı." : " Admin için AUTH_SECRET + e-posta + şifre yazın."}
          </p>
        </section>
        <div style={{ marginTop: 14 }}>
          <ConnectGuide
            kicker="Bağlantı sırası"
            title="Eksik parça kalmasın"
            copyValue={deploy.instagramWebhookUrl}
            steps={[
              {
                title: "Supabase Postgres",
                body: "Yeni proje açın. Connect → Transaction pooler (6543) = DATABASE_URL, sonuna ?pgbouncer=true&connection_limit=1 ekleyin. Session/direct (5432) = DIRECT_URL. prisma/schema.postgres.prisma içeriğini schema.prisma’ya alın (provider postgresql). prisma/supabase-init.sql ve prisma/supabase-rls.sql dosyalarını SQL Editor’de çalıştırın. Data API’yi kapatabilirsiniz; uygulama Prisma kullanır.",
              },
              {
                title: "Vercel env",
                body: `Aynı isimleri Production/Preview/Development’a yazın: DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL, CRON_SECRET, GOOGLE_PLACES_API_KEY, LLM_API_KEY, WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID, IG_ACCESS_TOKEN, IG_USER_ID, IG_WEBHOOK_VERIFY_TOKEN. APP_URL = ${deploy.appUrl || "https://projeniz.vercel.app"}`,
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
