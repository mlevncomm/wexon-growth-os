"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

type Playbook = {
  tone: string;
  rules: string;
  forbidden: string;
  offer: string;
  cta: string;
};

type Msg = { id: string; role: string; body: string };

export default function KocPage() {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [playbookActive, setPlaybookActive] = useState(false);
  const [hasLlm, setHasLlm] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  function apply(json: {
    messages?: Msg[];
    playbook?: Playbook;
    playbookActive?: boolean;
    hasLlm?: boolean;
  }) {
    setMessages(json.messages ?? []);
    setPlaybook(json.playbook ?? null);
    setPlaybookActive(Boolean(json.playbookActive));
    setHasLlm(Boolean(json.hasLlm));
  }

  useEffect(() => {
    const boot = window.setTimeout(() => {
      fetch("/api/coach")
        .then((r) => r.json())
        .then(apply)
        .catch(() => toast.push("Koç yüklenemedi", "bad"));
    }, 0);
    return () => window.clearTimeout(boot);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setText("");
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "user", body: message }]);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Yanıt yok");
      apply(json);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Koç yanıt vermedi", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function reset(playbookToo: boolean) {
    const res = await fetch(`/api/coach${playbookToo ? "?playbook=1" : ""}`, { method: "DELETE" });
    const json = await res.json();
    apply(json);
    toast.push(playbookToo ? "Sohbet ve playbook silindi" : "Sohbet temizlendi");
  }

  return (
    <div>
      <div className="page-kicker">Marka</div>
      <h1 className="page-title">AI koç</h1>
      <p className="page-copy">
        Ton, yasak kelime, fiyat dili ve CTA’yı Türkçe anlatın. Öğrenilen kurallar kalıcı playbook olur; Mesaj ekranındaki AI yazımı buna uyar.
      </p>

      <div className="split" style={{ marginTop: 18 }}>
        <section className="card panel coach-panel">
          <div className="panel-head">
            <div>
              <div className="page-kicker">Sohbet</div>
              <h2>Öğret</h2>
            </div>
            <span className={`pill ${hasLlm ? "ok" : "warn"}`}>{hasLlm ? "AI bağlı" : "Anahtar yok"}</span>
          </div>
          <div className="coach-thread">
            {messages.length === 0 ? (
              <p className="panel-note">Örnek: Kısa ol, “ucuz” deme, keşif randevusu iste.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`coach-bubble ${m.role === "user" ? "me" : "ai"}`}>
                  <span>{m.role === "user" ? "Siz" : "Koç"}</span>
                  <p>{m.body}</p>
                </div>
              ))
            )}
            {busy ? <div className="muted" style={{ fontSize: 13 }}>Not alıyor…</div> : null}
            <div ref={bottom} />
          </div>
          <form className="coach-form" onSubmit={(e) => void send(e)}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Marka kuralını yazın"
              disabled={busy}
            />
            <button className="btn btn-wexon" type="submit" disabled={busy || !text.trim()}>
              Gönder
            </button>
          </form>
          <div className="save-row">
            <button className="btn btn-ghost" type="button" onClick={() => void reset(false)}>
              Sohbeti sil
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void reset(true)}>
              Playbook’u sıfırla
            </button>
          </div>
        </section>

        <section className="card panel">
          <div className="panel-head">
            <div>
              <div className="page-kicker">Kalıcı not</div>
              <h2>Playbook</h2>
            </div>
            <span className={`pill ${playbookActive ? "ok" : "mute"}`}>
              {playbookActive ? "Aktif" : "Boş"}
            </span>
          </div>
          <p className="panel-note">Fine-tune yok. Bu alanlar şablon üretimine enjekte edilir.</p>
          <div className="playbook-grid">
            <PlayRow label="Ton" value={playbook?.tone} />
            <PlayRow label="Kurallar" value={playbook?.rules} />
            <PlayRow label="Yasak" value={playbook?.forbidden} />
            <PlayRow label="Teklif" value={playbook?.offer} />
            <PlayRow label="CTA" value={playbook?.cta} />
          </div>
        </section>
      </div>
    </div>
  );
}

function PlayRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="key-block">
      <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5 }}>{value || "—"}</p>
    </div>
  );
}
