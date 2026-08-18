"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavRail } from "./NavRail";
import { QueuePanel } from "./QueuePanel";

type Stats = {
  hasPlacesKey?: boolean;
  waCloud?: boolean;
  waLocal?: string;
  lastCampaign?: { status: string; foundCount: number; targetCount: number } | null;
};
type Snap = { queued?: number; pending?: number; sentToday?: number; dailyCap?: number };

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queueOpen, setQueueOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState("Son 30 gün");
  const campaign = stats?.lastCampaign;
  const scanning = Boolean(campaign && (campaign.status === "running" || campaign.status === "queued"));
  const scanPct = campaign && scanning
    ? Math.min(100, Math.round((campaign.foundCount / Math.max(1, campaign.targetCount)) * 100))
    : 0;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [s, o] = await Promise.all([
          fetch("/api/stats", { cache: "no-store" }).then((r) => {
            if (r.status === 401) {
              window.location.href = "/giris";
              return {};
            }
            return r.json();
          }),
          fetch("/api/outreach", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})),
        ]);
        if (!alive) return;
        setStats(s);
        setSnap(o);
      } catch {
        /* ignore */
      }
    };
    const boot = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(load, scanning ? 1500 : 4000);
    return () => {
      alive = false;
      window.clearTimeout(boot);
      window.clearInterval(t);
    };
  }, [scanning]);

  useEffect(() => {
    setRange(last30());
  }, []);

  useEffect(() => {
    if (!queueOpen && !navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQueueOpen(false);
        setNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueOpen, navOpen]);

  function search(e: FormEvent) {
    e.preventDefault();
    setNavOpen(false);
    router.push(`/musteriler?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className={`os${queueOpen ? " queue-open" : ""}${navOpen ? " nav-open" : ""}`}>
      <NavRail
        queueOpen={queueOpen}
        onQueueToggle={() => setQueueOpen((v) => !v)}
        onNavigate={() => setNavOpen(false)}
        places={Boolean(stats?.hasPlacesKey)}
        waCloud={Boolean(stats?.waCloud)}
        waLocal={stats?.waLocal ?? "disconnected"}
      />
      <div className="os-stage">
        <header className="os-top">
          <button className="btn btn-ghost menu-btn" type="button" aria-label="Menü" onClick={() => setNavOpen(true)}>
            Menü
          </button>
          <form className="search" onSubmit={search}>
            <span className="search-ico" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.2" />
                <path d="M16.2 16.2 20.4 20.4" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Müşteri, telefon veya bölge ara"
            />
            <kbd className="kbd">Ctrl F</kbd>
          </form>
          <div className="top-actions">
            <div className="top-chip" title="Son 30 gün">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <rect x="4" y="5.5" width="16" height="14.5" rx="2.2" />
                <path d="M8 3.8v3.2M16 3.8v3.2M4 10h16" />
              </svg>
              <span>{range}</span>
            </div>
            {/* File download, not an App Router page */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="top-export" href="/api/leads/export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M12 4.5v10.2M8.2 11.2 12 15l3.8-3.8M5 19.2h14" />
              </svg>
              Dışa aktar
            </a>
            <button
              className={`btn btn-wexon queue-toggle${((snap?.queued ?? 0) + (snap?.pending ?? 0)) > 0 ? " has-q" : ""}`}
              type="button"
              onClick={() => setQueueOpen(true)}
            >
              Kuyruk
              <span className="q-count">{(snap?.queued ?? 0) + (snap?.pending ?? 0)}</span>
            </button>
          </div>
        </header>
        <div className="os-scan">{scanning ? <span style={{ width: `${scanPct}%` }} /> : null}</div>
        <main className="os-main">{children}</main>
      </div>
        <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
      <button type="button" className="nav-backdrop" aria-label="Menüyü kapat" onClick={() => setNavOpen(false)} />
      <button type="button" className="queue-backdrop" aria-label="Kuyruğu kapat" onClick={() => setQueueOpen(false)} />
    </div>
  );
}

function last30() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const fmt = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return `${fmt(start)} — ${fmt(end)}`;
}
