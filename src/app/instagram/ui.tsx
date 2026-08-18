"use client";

import { useEffect, useState } from "react";
import { ConnectGuide } from "@/components/ConnectGuide";
import { useToast } from "@/components/Toast";

type Thread = {
  id: string;
  igsid: string;
  username: string;
  lastText: string;
  lastAt: string | null;
  draft: string;
  messages: Array<{ id: string; direction: string; body: string }>;
};

export default function InstagramPage() {
  const toast = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [configured, setConfigured] = useState(false);
  const [warning, setWarning] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualText, setManualText] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const current = threads.find((t) => t.id === selected) ?? null;

  async function load() {
    const res = await fetch("/api/instagram", { cache: "no-store" });
    const json = await res.json();
    setConfigured(Boolean(json.configured));
    setThreads(json.threads ?? []);
    setWarning(json.warning ?? "");
    setWebhookUrl(typeof json.webhookUrl === "string" ? json.webhookUrl : "");
    if (!selected && json.threads?.[0]?.id) {
      setSelected(json.threads[0].id);
      setDraft(json.threads[0].draft || "");
    }
  }

  useEffect(() => {
    const boot = window.setTimeout(() => void load().catch(() => toast.push("Instagram yüklenemedi", "bad")), 0);
    return () => window.clearTimeout(boot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current) setDraft(current.draft);
  }, [current?.id, current?.draft]);

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    try {
      const res = await fetch("/api/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "İşlem başarısız");
      if (json.draft) setDraft(json.draft);
      if (json.threads) setThreads(json.threads);
      if (action === "send") toast.push("Instagram mesajı gönderildi");
      if (action === "draft") toast.push("Taslak yazıldı");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Instagram hata", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-kicker">Kanal</div>
      <h1 className="page-title">Instagram DM</h1>
      <p className="page-copy">
        Resmi Meta Graph. Soğuk outbound yok: gelen mesaj + onaylı cevap. Webhook için canlı HTTPS gerekir; bu makinede 127.0.0.1 yetmez.
      </p>
      <div className="notice" style={{ marginTop: 16 }}>
        {configured ? "Business hesabı bağlı." : "Sistem’e Instagram token ve kullanıcı ID yazın."}{" "}
        {warning ? warning : "Gönderim yalnızca siz onayladıktan sonra gider."}
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <section className="card panel">
          <div className="panel-head">
            <div>
              <div className="page-kicker">Gelen</div>
              <h2>Konuşmalar</h2>
            </div>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void act("refresh", { action: "refresh" })}>
              Yenile
            </button>
          </div>
          {threads.length === 0 ? (
            <p className="panel-note">Gelen kutu boş. Token varsa Yenile; webhook ikinci adımdır.</p>
          ) : (
            <div className="key-stack">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`key-block${selected === t.id ? " on" : ""}`}
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => setSelected(t.id)}
                >
                  <strong>{t.username || t.igsid}</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t.lastText.slice(0, 90) || "Mesaj yok"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card panel">
          <div className="panel-head">
            <div>
              <div className="page-kicker">Taslak</div>
              <h2>Onaylı cevap</h2>
            </div>
          </div>
          {current ? (
            <>
              <div className="coach-thread" style={{ minHeight: 120 }}>
                {current.messages.map((m) => (
                  <div key={m.id} className={`coach-bubble ${m.direction === "out" ? "me" : "ai"}`}>
                    <span>{m.direction === "out" ? "Siz" : current.username || "Gelen"}</span>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Gönderilecek metin</span>
                <textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <div className="save-row">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void act("draft", { action: "draft", threadId: current.id })}
                >
                  AI taslak
                </button>
                <button
                  className="btn btn-wexon"
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void act("send", { action: "send", threadId: current.id, text: draft })}
                >
                  Onayla ve gönder
                </button>
              </div>
            </>
          ) : (
            <p className="panel-note">Soldan bir konuşma seçin.</p>
          )}

          <div className="key-block" style={{ marginTop: 18 }}>
            <div className="page-kicker">Manuel</div>
            <p className="panel-note">Kayıttaki IGSID’ye tek onaylı mesaj. Soğuk spam için kullanmayın.</p>
            <label className="field">
              <span>IGSID</span>
              <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="Gelen kutudaki ID" />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span>Metin</span>
              <textarea rows={3} value={manualText} onChange={(e) => setManualText(e.target.value)} />
            </label>
            <div className="save-row">
              <button
                className="btn btn-wexon"
                type="button"
                disabled={busy || !manualId.trim() || !manualText.trim()}
                onClick={() => void act("manual", { action: "manual", igsid: manualId, text: manualText })}
              >
                Onayla ve gönder
              </button>
            </div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 18 }}>
        <ConnectGuide
          kicker="Instagram Professional"
          title="Resmi API nasıl bağlanır"
          copyValue={webhookUrl}
          steps={[
            {
              title: "Professional hesap",
              body: "Instagram Business veya Creator hesabı şart. Kişisel hesap / şifre ile bot girişi yok ve yasaktır.",
            },
            {
              title: "Meta uygulama",
              body: "developers.facebook.com’da uygulama açın. Instagram ürününü ekleyin. Sayfayı Instagram’a bağlayın. instagram_manage_messages ve instagram_manage_inbox izinlerini isteyin.",
            },
            {
              title: "Token ve user ID",
              body: "Page access token (uzun ömürlü) ve Instagram user ID’yi Sistem ekranına yazın. Maskeli alan değişmezse eski değer korunur.",
            },
            {
              title: "Webhook (canlı HTTPS)",
              body: "Meta webhook callback URL olarak aşağıdaki adresi verin. Verify token Sistem’deki ile aynı olsun. 127.0.0.1 kabul edilmez; Vercel veya tünel gerekir. Alan: messages.",
            },
            {
              title: "Onaylı cevap",
              body: "Gelen DM burada listelenir. AI taslak yazar; siz Onayla ve gönder deyince Graph ile gider. Soğuk outbound spam resmi API’de pratik değil.",
            },
          ]}
        />
      </div>
    </div>
  );
}
