"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/", label: "Panel" },
  { href: "/ara", label: "Keşif" },
  { href: "/musteriler", label: "Müşteriler" },
  { href: "/whatsapp", label: "Mesaj" },
  { href: "/koc", label: "Koç" },
] as const;

function Ico({ href }: { href: string }) {
  const p = {
    className: "nav-ico",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
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
  if (href === "/whatsapp") {
    return (
      <svg {...p}>
        <path d="M5 16.6V7.8A2.3 2.3 0 0 1 7.3 5.5h9.4A2.3 2.3 0 0 1 19 7.8v5.4a2.3 2.3 0 0 1-2.3 2.3H9.2L5 16.6z" />
      </svg>
    );
  }
  if (href === "/koc") {
    return (
      <svg {...p}>
        <path d="M12 5.2 13.4 8l3 .4-2.2 2.1.6 3L12 12.1 9.2 13.5l.6-3L7.6 8.4l3-.4z" />
        <path d="M5.4 16.4c1.4-1.6 3.8-2.6 6.6-2.6s5.2 1 6.6 2.6" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 4.6v1.7M12 17.7v1.7M4.6 12h1.7M17.7 12h1.7M6.8 6.8l1.2 1.2M16 16l1.2 1.2M17.2 6.8 16 8M8 16l-1.2 1.2" />
    </svg>
  );
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function operatorLine(opts: { places: boolean; waCloud: boolean; waLocal: string }) {
  if (opts.waCloud || opts.waLocal === "ready") {
    return opts.places ? "WhatsApp · Places hazır" : "WhatsApp bağlı";
  }
  if (opts.waLocal === "qr") return "QR bekleniyor";
  if (opts.waLocal === "starting") return "WhatsApp açılıyor";
  if (opts.waLocal === "error") return "WhatsApp hata";
  if (opts.places) return "Places hazır · kanal kapalı";
  return "Sistemi tamamla";
}

export function NavRail({
  queueOpen,
  onQueueToggle,
  onNavigate,
  places = false,
  waCloud = false,
  waLocal = "disconnected",
}: {
  queueOpen: boolean;
  onQueueToggle: () => void;
  onNavigate: () => void;
  places?: boolean;
  waCloud?: boolean;
  waLocal?: string;
}) {
  const pathname = usePathname();
  const [canLogout, setCanLogout] = useState(false);
  useEffect(() => {
    void fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => setCanLogout(Boolean(j.configured)))
      .catch(() => setCanLogout(false));
  }, []);
  const waOn = waCloud || waLocal === "ready";
  const live = waOn || waLocal === "qr" || waLocal === "starting";
  const line = operatorLine({ places, waCloud, waLocal });
  return (
    <nav className="os-rail" aria-label="Modüller">
      <div className="brand">
        <div className="brand-initial" aria-hidden>W</div>
        <div className="brand-name">
          <strong>Wexon</strong>
          <span>Growth OS</span>
        </div>
      </div>

      <div className="nav-group">Satış</div>
      {MAIN.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={`nav-link${isActive(pathname, m.href) ? " active" : ""}`}
          onClick={onNavigate}
        >
          <div className="nav-ico-wrap" aria-hidden>
            <Ico href={m.href} />
          </div>
          <span className="nav-label">{m.label}</span>
        </Link>
      ))}

      <div className="nav-group">Araçlar</div>
      <Link
        href="/instagram"
        className={`nav-link${pathname.startsWith("/instagram") ? " active" : ""}`}
        onClick={onNavigate}
      >
        <div className="nav-ico-wrap" aria-hidden>
          <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5.5" y="5.5" width="13" height="13" rx="3.2" />
            <circle cx="12" cy="12" r="3.1" />
            <circle cx="16.2" cy="7.8" r="0.7" fill="currentColor" />
          </svg>
        </div>
        <span className="nav-label">Instagram</span>
      </Link>
      <Link
        href="/ayarlar"
        className={`nav-link${pathname.startsWith("/ayarlar") ? " active" : ""}`}
        onClick={onNavigate}
      >
        <div className="nav-ico-wrap" aria-hidden>
          <Ico href="/ayarlar" />
        </div>
        <span className="nav-label">Sistem</span>
      </Link>

      <div className="rail-foot">
        <div className="rail-switch">
          <span>Kuyruk</span>
          <button
            type="button"
            className={`switch${queueOpen ? " on" : ""}`}
            aria-pressed={queueOpen}
            aria-label="Kuyruğu aç"
            onClick={onQueueToggle}
          >
            <i />
          </button>
        </div>
        <Link href="/ayarlar" className="op-card" onClick={onNavigate}>
          <div className={`op-ava${live ? " on" : waLocal === "error" ? " bad" : ""}`}>
            W
            <i className={`op-dot${waOn ? "" : waLocal === "error" ? " bad" : live ? " warn" : " off"}`} />
          </div>
          <div className="op-meta">
            <b>Admin</b>
            <span>{line}</span>
          </div>
        </Link>
        {canLogout ? (
        <button
          className="btn btn-ghost"
          type="button"
          style={{ width: "100%" }}
          onClick={() => {
            void fetch("/api/auth", { method: "DELETE" }).then(() => {
              window.location.href = "/giris";
            });
          }}
        >
          Çıkış
        </button>
        ) : null}
      </div>
    </nav>
  );
}
