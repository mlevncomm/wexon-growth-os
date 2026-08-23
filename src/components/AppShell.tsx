"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchStats } from "@/lib/stats-client";
import { isActive, NavRail } from "./NavRail";

const QueuePanel = dynamic(
  () => import("./QueuePanel").then((m) => ({ default: m.QueuePanel })),
  { ssr: false },
);

type Stats = {
  hasPlacesKey?: boolean;
  waCloud?: boolean;
  waLocal?: string;
  queued?: number;
  lastCampaign?: { status: string; foundCount: number; targetCount: number } | null;
};

const DOCK = [
  { href: "/", label: "Panel" },
  { href: "/ara", label: "Keşif" },
  { href: "/musteriler", label: "Liste" },
  { href: "/whatsapp", label: "Mesaj" },
] as const;

function DockIco({ href }: { href: string }) {
  const p = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (href === "/") {
    return (
      <svg {...p}>
        <path d="M4.5 11.2 12 4.6l7.5 6.6" />
        <path d="M6.2 10.4V19a1.2 1.2 0 0 0 1.2 1.2h3.1v-5.1h3V20.2h3.1A1.2 1.2 0 0 0 17.8 19v-8.6" />
      </svg>
    );
  }
  if (href === "/ara") {
    return (
      <svg {...p}>
        <circle cx="11" cy="11" r="6.2" />
        <path d="M16.2 16.2 20.4 20.4" />
      </svg>
    );
  }
  if (href === "/musteriler") {
    return (
      <svg {...p}>
        <circle cx="9" cy="8.2" r="2.4" />
        <path d="M4.6 17.4c.4-2.6 2.3-4 4.4-4s4 1.4 4.4 4" />
        <circle cx="16.2" cy="9" r="2" />
        <path d="M15.2 13.6c1.8.2 3.4 1.3 3.8 3.4" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <path d="M5 16.6V7.8A2.3 2.3 0 0 1 7.3 5.5h9.4A2.3 2.3 0 0 1 19 7.8v5.4a2.3 2.3 0 0 1-2.3 2.3H9.2L5 16.6z" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [queueOpen, setQueueOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState("Son 30 gün");
  const campaign = stats?.lastCampaign;
  const scanning = Boolean(campaign && (campaign.status === "running" || campaign.status === "queued"));
  const scanPct = campaign && scanning
    ? Math.min(100, Math.round((campaign.foundCount / Math.max(1, campaign.targetCount)) * 100))
    : 0;
  const queueCount = stats?.queued ?? 0;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    let delay = scanning ? 2000 : 12_000;
    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (alive) timer = window.setTimeout(() => void load(), delay);
    };
    const load = async () => {
      if (!alive || document.hidden) return;
      try {
        const next = await fetchStats(scanning);
        if (!alive) return;
        setStats(next);
        delay = scanning ? 2000 : 12_000;
      } catch {
        delay = Math.min(delay * 2, 60_000);
      }
      schedule();
    };
    void load();
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clear();
      document.removeEventListener("visibilitychange", onVis);
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
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
              placeholder="Müşteri veya bölge"
              enterKeyHint="search"
            />
            <kbd className="kbd">Ctrl F</kbd>
          </form>
          <div className="top-actions">
            <div className="top-chip" title="Gösterge: son 30 gün. Listeyi filtrelemez.">
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
              className={`btn btn-wexon queue-toggle${queueCount > 0 ? " has-q" : ""}`}
              type="button"
              onClick={() => setQueueOpen(true)}
            >
              <span className="queue-label">Kuyruk</span>
              <span className="q-count">{queueCount}</span>
            </button>
          </div>
        </header>
        <div className="os-scan">{scanning ? <span style={{ width: `${scanPct}%` }} /> : null}</div>
        <main className="os-main">{children}</main>
      </div>
      <nav className="os-dock" aria-label="Hızlı menü">
        {DOCK.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`dock-link${isActive(pathname, item.href) ? " active" : ""}`}
            onClick={() => setNavOpen(false)}
          >
            <DockIco href={item.href} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" className="dock-link" onClick={() => setNavOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="6.5" cy="12" r="1.4" />
            <circle cx="12" cy="12" r="1.4" />
            <circle cx="17.5" cy="12" r="1.4" />
          </svg>
          <span>Daha</span>
        </button>
      </nav>
      {queueOpen ? <QueuePanel open onClose={() => setQueueOpen(false)} /> : null}
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
