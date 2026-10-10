"use client";

import { useEffect, useState } from "react";

const ARALIK_MS = 4 * 60 * 1000;

/** Yeni bir yayın çıkınca köşede "Yeni sürüm var · Güncelle" gösterir. */
export function SurumKontrol() {
  const [yeni, setYeni] = useState(false);

  useEffect(() => {
    let ilk: string | null = null;
    let alive = true;
    const kontrol = async () => {
      if (!alive || document.hidden) return;
      try {
        const r = await fetch("/api/surum", { cache: "no-store" });
        const { surum } = (await r.json()) as { surum?: string };
        if (!surum) return;
        if (ilk === null) ilk = surum;
        else if (surum !== ilk) setYeni(true);
      } catch {}
    };
    void kontrol();
    const t = window.setInterval(() => void kontrol(), ARALIK_MS);
    const gorunur = () => { if (!document.hidden) void kontrol(); };
    document.addEventListener("visibilitychange", gorunur);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", gorunur); };
  }, []);

  if (!yeni) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 90, display: "flex", alignItems: "center", gap: 12,
        background: "var(--teal)", color: "#fff", borderRadius: 16, padding: "10px 12px 10px 16px",
        boxShadow: "0 12px 30px rgba(11, 79, 74, 0.28)", fontSize: 13.5,
      }}
    >
      <span>Yeni sürüm var</span>
      <button
        type="button"
        className="btn btn-mint"
        style={{ minHeight: 34, padding: "0 14px" }}
        onClick={() => window.location.reload()}
      >
        Güncelle
      </button>
    </div>
  );
}
