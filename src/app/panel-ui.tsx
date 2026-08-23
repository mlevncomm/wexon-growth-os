"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EMPTY_STATS, fetchStats, type DashboardStats } from "@/lib/stats-client";
import { formatPhoneDisplay } from "@/lib/phone";
import { statusLabel } from "@/lib/lead-status";

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  city: string;
  district: string;
  createdAt: string;
};

export default function PanelPage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [listReady, setListReady] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    void fetchStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message));
    void fetch("/api/leads?take=60&lite=1")
      .then(async (res) => {
        const data = (await res.json()) as Lead[] & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Liste alınamadı");
        setLeads(data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setListReady(true));
  }, []);

  const buckets = useMemo(() => buildBuckets(leads ?? [], mode), [leads, mode]);
  const maxUp = Math.max(1, ...buckets.map((b) => b.found));
  const maxDn = Math.max(1, ...buckets.map((b) => b.sent));
  const foundSum = buckets.reduce((n, b) => n + b.found, 0);
  const sentSum = buckets.reduce((n, b) => n + b.sent, 0);
  const prevFound = useMemo(() => previousFound(leads ?? [], mode), [leads, mode]);
  const delta = prevFound === 0 ? (foundSum > 0 ? 100 : 0) : Math.round(((foundSum - prevFound) / prevFound) * 100);

  return (
    <div>
      {error ? <p className="error-box">{error}</p> : null}
      {!stats.hasPlacesKey ? (
        <p className="notice" style={{ marginBottom: 14 }}>
          Places anahtarı yok. Keşiften önce <Link href="/ayarlar">Sistem</Link> ekranına anahtarı yaz.
        </p>
      ) : null}

      <section className="hero">
        <div>
          <div className="hero-kicker">Satış pipeline</div>
          <div className="hero-val">
            {stats.leadsTotal.toLocaleString("tr-TR")}
            <span className="delta">{delta >= 0 ? "+" : ""}{delta}% ↗</span>
          </div>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
            Bugün {stats.leadsToday} yeni · {stats.yeni} henüz yazılmadı
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-mint" href="/ara">+ Keşif</Link>
          <Link className="btn btn-on-teal" href="/whatsapp">Gönder</Link>
          <Link className="btn btn-on-teal" href="/musteriler">Liste</Link>
        </div>
      </section>

      <div className="flow">
        <div className="card">
          <div className="flow-head">
            <div>
              <div className="page-kicker">Akış</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>Keşif / satış</h2>
            </div>
            <div className="seg">
              <button type="button" className={mode === "weekly" ? "on" : ""} onClick={() => setMode("weekly")}>Haftalık</button>
              <button type="button" className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")}>Günlük</button>
            </div>
          </div>
          <div className="bars" aria-label="Keşif ve gönderim çubukları">
            {buckets.map((b) => (
              <div key={b.label} className="bar-col">
                <div className="bar-up" style={{ height: `${Math.max(8, (b.found / maxUp) * 100)}%` }} />
                <div className="bar-lab">{b.label}</div>
                <div className="bar-dn" style={{ height: `${Math.max(8, (b.sent / maxDn) * 100)}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="side-kpis">
          <article className="side-kpi">
            <div className="ico-round">↑</div>
            <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Keşif</div>
            <b>{foundSum}</b>
            <span className="pill ok">{delta >= 0 ? "+" : ""}{delta}%</span>
          </article>
          <article className="side-kpi">
            <div className="ico-round">↓</div>
            <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Gönderilen</div>
            <b>{sentSum}</b>
            <span className="muted" style={{ fontSize: 12 }}>dönemde yazıldı</span>
          </article>
        </div>
      </div>

      <div className="kpis">
        <Mini title="Bekleyen kuyruk" value={stats.queued} hint="Mesaj sırası" />
        <Mini title="Günlük tavan" value={`${stats.sentToday}/${stats.dailyCap}`} hint="Bugün giden mesaj" />
        <Mini title="Yeni kayıt" value={stats.yeni} hint="Henüz yazılmayan" />
      </div>

      <div className="split-bottom">
        <div className="card">
          <div className="flow-head">
            <div>
              <div className="page-kicker">Son hareket</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>Müşteriler</h2>
            </div>
            <Link className="btn btn-ghost" href="/musteriler">Tümü</Link>
          </div>
          <div className="activity-row act-head">
            <span>Tip</span>
            <span>Bölge</span>
            <span>Durum</span>
            <span>Yöntem</span>
          </div>
          {!listReady ? (
            <div className="skel" style={{ height: 80 }} />
          ) : leads.length === 0 ? (
            <div className="empty" style={{ padding: "24px 0" }}>
              <strong>Kayıt yok</strong>
              Keşif ekranından alıcı işletme tarayın.
            </div>
          ) : (
            leads.slice(0, 6).map((lead) => (
              <div key={lead.id} className="activity-row">
                <div>
                  <div style={{ fontWeight: 700 }}>{lead.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(lead.createdAt).toLocaleDateString("tr-TR")}</div>
                </div>
                <span className="muted">{[lead.district, lead.city].filter(Boolean).join(" · ") || "—"}</span>
                <span className={`pill ${pillTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                <span className="muted">{lead.phone ? formatPhoneDisplay(lead.phone) : "Telefon yok"}</span>
              </div>
            ))
          )}
        </div>

        <article className="campaign-card">
          <div>
            <div className="page-kicker" style={{ color: "rgba(255,255,255,0.7)" }}>Son keşif</div>
            {stats.lastCampaign ? (
              <>
                <h3 style={{ margin: "10px 0 6px", fontSize: 22 }}>{stats.lastCampaign.query}</h3>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  {stats.lastCampaign.district || stats.lastCampaign.city} · {campaignStatus(stats.lastCampaign.status)}
                </div>
              </>
            ) : (
              <h3 style={{ margin: "10px 0 6px", fontSize: 22 }}>Henüz keşif yok</h3>
            )}
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em" }}>
              {stats.lastCampaign ? `${stats.lastCampaign.foundCount}/${stats.lastCampaign.targetCount}` : "—"}
            </div>
            <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
              {stats.hasPlacesKey ? "Places bağlı" : "Places anahtarı yok"}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function Mini({ title, value, hint }: { title: string; value: number | string; hint: string }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="kpi-ico">◆</div>
        <span className="muted" style={{ fontSize: 12 }}>Son 30 gün</span>
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{title}</div>
      <div className="kpi-val">{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{hint}</div>
    </div>
  );
}

function pillTone(status: string) {
  if (status === "yazildi" || status === "donus_var") return "ok";
  if (status === "yeni") return "warn";
  return "mute";
}

function campaignStatus(status: string) {
  if (status === "running" || status === "queued") return "çalışıyor";
  if (status === "done") return "bitti";
  if (status === "error") return "hata";
  if (status === "cancelled") return "durduruldu";
  return status;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildBuckets(leads: Lead[], mode: "daily" | "weekly") {
  const now = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    if (mode === "daily") {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - i));
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      return {
        label: day.toLocaleDateString("tr-TR", { weekday: "short" }).replace(".", "").slice(0, 2),
        found: leads.filter((l) => inRange(l.createdAt, day, next)).length,
        sent: leads.filter((l) => l.status === "yazildi" && inRange(l.createdAt, day, next)).length,
      };
    }
    const end = new Date(now);
    end.setDate(now.getDate() - (6 - i) * 7 + 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    return {
      label: `H${i + 1}`,
      found: leads.filter((l) => inRange(l.createdAt, start, end)).length,
      sent: leads.filter((l) => l.status === "yazildi" && inRange(l.createdAt, start, end)).length,
    };
  });
}

function previousFound(leads: Lead[], mode: "daily" | "weekly") {
  const now = startOfDay(new Date());
  const span = mode === "daily" ? 7 : 49;
  const start = new Date(now);
  start.setDate(now.getDate() - span * 2);
  const mid = new Date(now);
  mid.setDate(now.getDate() - span);
  return leads.filter((l) => inRange(l.createdAt, start, mid)).length;
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}
