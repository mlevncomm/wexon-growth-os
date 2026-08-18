"use client";

import { useEffect, useState } from "react";
import { useToast } from "./Toast";

type Draft = { id: string; name: string; phone: string; message: string; channel: string };

type Snapshot = {
  paused: boolean;
  stopped: boolean;
  dailyCap: number;
  delayMinSec: number;
  delayMaxSec: number;
  cloud?: boolean;
  queued: number;
  pending?: number;
  sending: number;
  sentToday: number;
  failed: number;
  current: { id: string; status: string; name: string; phone: string } | null;
  drafts?: Draft[];
};

export function QueuePanel({ onClose, open = false }: { onClose?: () => void; open?: boolean }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let timer: number | undefined;
    let delay = 2500;
    const load = async () => {
      try {
        const res = await fetch("/api/outreach", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) setSnap(await res.json());
        delay = res.ok ? 2500 : Math.min(delay * 2, 60_000);
      } catch {
        delay = Math.min(delay * 2, 60_000);
      }
      if (alive) timer = window.setTimeout(() => void load(), delay);
    };
    const boot = window.setTimeout(() => void load(), 0);
    return () => {
      alive = false;
      window.clearTimeout(boot);
      if (timer) window.clearTimeout(timer);
    };
  }, [open]);

  async function control(action: "pause" | "resume" | "stop") {
    await fetch("/api/outreach/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const res = await fetch("/api/outreach", { cache: "no-store" });
    if (res.ok) setSnap(await res.json());
    toast.push(
      action === "pause" ? "Gönderim duraklatıldı" : action === "resume" ? "Gönderim devam ediyor" : "Kuyruk durduruldu",
    );
  }

  async function moderate(id: string, action: "approve" | "reject" | "edit") {
    const message = action === "edit" ? (editing[id] ?? snap?.drafts?.find((d) => d.id === id)?.message ?? "") : undefined;
    const res = await fetch("/api/outreach/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.push(json.error || "Onaylanamadı", "bad");
      return;
    }
    const next = await fetch("/api/outreach", { cache: "no-store" });
    if (next.ok) setSnap(await next.json());
    toast.push(action === "reject" ? "Reddedildi" : action === "edit" ? "Düzenlenip kuyruğa alındı" : "Onaylandı, gönderilecek");
  }

  const waiting = (snap?.queued ?? 0) + (snap?.sending ?? 0);
  const pending = snap?.pending ?? snap?.drafts?.length ?? 0;
  const cap = snap?.dailyCap ?? 40;
  const sent = snap?.sentToday ?? 0;
  const pct = Math.min(100, Math.round((sent / Math.max(1, cap)) * 100));
  const live = waiting > 0 && !snap?.paused && !snap?.stopped;
  const label = snap?.stopped
    ? "Durdu"
    : snap?.paused
      ? "Duraklatıldı"
      : pending
        ? `${pending} onay bekliyor`
        : waiting
          ? "Gönderiyor"
          : "Boş kuyruk";

  return (
    <aside className="os-queue" aria-label="Kuyruk" inert={open ? undefined : true}>
      <button className="btn btn-ghost" type="button" onClick={onClose}>
        Kapat
      </button>
      <div>
        <div className="page-kicker">Kuyruk</div>
        <h2 style={{ margin: "8px 0 0", fontSize: 26, letterSpacing: "-0.04em" }}>{label}</h2>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          {snap?.cloud ? "Kanal: WhatsApp Cloud" : "Kanal: QR yedek (Cloud yok)"}
        </div>
      </div>
      {pending > 0 ? (
        <div className="pending-list">
          <div className="muted" style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 700 }}>ONAY</div>
          {(snap?.drafts ?? []).map((d) => (
            <div key={d.id} className="pending-item">
              <strong>{d.name}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{d.phone}</div>
              <textarea
                rows={4}
                value={editing[d.id] ?? d.message}
                onChange={(e) => setEditing((prev) => ({ ...prev, [d.id]: e.target.value }))}
              />
              <div className="pending-actions">
                <button className="btn btn-wexon" type="button" onClick={() => void moderate(d.id, "approve")}>
                  Onayla
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => void moderate(d.id, "edit")}>
                  Düzenle
                </button>
                <button className="btn btn-danger" type="button" onClick={() => void moderate(d.id, "reject")}>
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="paper">
        <div className="muted" style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 700 }}>SIRADAKİ</div>
        <div style={{ marginTop: 8, fontWeight: 800 }}>{snap?.current?.name ?? "Bekleyen yok"}</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {snap?.current?.phone || "Onaylananlar tavan ve gecikmeyle gider"}
        </div>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Bugün {sent}/{cap}</div>
        <div className="progress teal"><span style={{ width: `${pct}%` }} /></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {waiting} sırada · {pending} onay · {snap?.delayMinSec ?? 20}–{snap?.delayMaxSec ?? 45} sn
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        <span className={`dot${live ? "" : snap?.paused ? " warn" : " off"}`} />
        {live ? "Canlı gönderim" : "Beklemede"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {snap?.paused || snap?.stopped ? (
          <button className="btn btn-wexon" type="button" onClick={() => void control("resume")}>
            Gönderime devam et
          </button>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => void control("pause")}>
            Gönderimi duraklat
          </button>
        )}
        <button className="btn btn-danger" type="button" onClick={() => void control("stop")}>
          Kuyruğu durdur
        </button>
      </div>
    </aside>
  );
}
