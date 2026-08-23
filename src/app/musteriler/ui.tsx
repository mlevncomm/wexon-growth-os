"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { LEAD_STATUSES } from "@/lib/lead-status";
import { useToast } from "@/components/Toast";

type Lead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  mapsUrl: string;
  city: string;
  district: string;
  status: string;
  notes: string;
  consented: boolean;
};
type Template = { id: string; name: string };

export default function MusterilerPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load(nextQ = q, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextStatus) params.set("status", nextStatus);
    params.set("take", "150");
    const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
    const data = (await res.json()) as Lead[] & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Liste alınamadı");
    setLeads(data as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    const boot = window.setTimeout(() => {
      const initial = new URLSearchParams(window.location.search).get("q") ?? "";
      setQ(initial);
      void load(initial, "").catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
      fetch("/api/templates")
        .then((r) => r.json())
        .then((rows: Template[]) => {
          setTemplates(rows);
          if (rows[0]) setTemplateId(rows[0].id);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(boot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  async function patch(id: string, body: Partial<Lead>) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.push("Kayıt güncellenemedi", "bad");
      return;
    }
    const updated = (await res.json()) as Lead;
    setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }

  async function enqueue(allMatching = false) {
    setError("");
    const res = await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        allMatching
          ? { allMatching: true, q, status, templateId }
          : { leadIds: selectedIds, templateId },
      ),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Kuyruk oluşmadı");
      toast.push(json.error || "Kuyruk oluşmadı", "bad");
      return;
    }
    setSelected({});
    toast.push(`${json.queued} kişi onay bekliyor${json.skipped ? `, ${json.skipped} atlandı` : ""}. Kuyruk çekmecesinden Onayla.`);
  }

  async function remove(allMatching = false) {
    const count = allMatching ? leads.length : selectedIds.length;
    if (!count) return;
    const scope = allMatching
      ? `Ekrandaki ${count} kayıt (filtre dahil) silinecek.`
      : `${count} seçili müşteri silinecek.`;
    if (!window.confirm(`${scope} Keşifte aynı işletmeler yeniden çıkabilir.`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          allMatching
            ? { allMatching: true, q, status }
            : { leadIds: selectedIds },
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Silinemedi");
        toast.push(json.error || "Silinemedi", "bad");
        return;
      }
      setSelected({});
      toast.push(`${json.deleted} müşteri silindi`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function selectVisible(onlyPhone = false) {
    const next: Record<string, boolean> = {};
    for (const lead of leads) {
      if (!onlyPhone || lead.phone) next[lead.id] = true;
    }
    setSelected(next);
  }

  function LeadControls({ lead }: { lead: Lead }) {
    return (
      <>
        <select className="status-select" value={lead.status} onChange={(e) => void patch(lead.id, { status: e.target.value })}>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={lead.consented} onChange={(e) => void patch(lead.id, { consented: e.target.checked })} />
          Onaylı
        </label>
        <input
          className="cell-input"
          defaultValue={lead.notes}
          placeholder="kısa not"
          onBlur={(e) => {
            if (e.target.value !== lead.notes) void patch(lead.id, { notes: e.target.value });
          }}
        />
      </>
    );
  }

  return (
    <div>
      <div className="page-kicker">CRM</div>
      <h1 className="page-title">Müşteriler</h1>
      <p className="page-copy">
        Alıcı listesi. Silinen işletme keşifte yeniden bulunur; böylece demo veya eski tarama karışmaz.
        Kuyruğa yalnızca telefonu olan, daha önce yazılmamış kayıtlar girer.
      </p>

      <div className="toolbar">
        <label className="field">
          <span>Ara</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load();
              }
            }}
            placeholder="ad, adres, telefon, il"
          />
        </label>
        <label className="field">
          <span>Durum</span>
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              void load(q, next);
            }}
          >
            <option value="">Tümü</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Şablon</span>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
          <button className="btn btn-ghost" type="button" onClick={() => void load()}>Filtrele</button>
          <a className="btn btn-ghost" href={`/api/leads/export?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`}>Excel</a>
        </div>
      </div>

      <div className="selbar">
        <button className="btn btn-ghost" type="button" disabled={!leads.length} onClick={() => selectVisible(false)}>
          Tümünü seç
        </button>
        <button className="btn btn-ghost" type="button" disabled={!leads.length} onClick={() => selectVisible(true)}>
          Telefonluları seç
        </button>
        <button className="btn btn-ghost" type="button" disabled={!selectedIds.length} onClick={() => setSelected({})}>
          Seçimi bırak
        </button>
        <button className="btn btn-wexon" type="button" disabled={!selectedIds.length || !templateId} onClick={() => void enqueue(false)}>
          {selectedIds.length} seçildi · Onaya al
        </button>
        <button className="btn btn-ghost" type="button" disabled={!templateId || !leads.length} onClick={() => void enqueue(true)}>
          Filtrelenenleri onaya al
        </button>
        <button
          className="btn btn-danger"
          type="button"
          disabled={busy || !selectedIds.length}
          onClick={() => void remove(false)}
        >
          Seçilenleri sil
        </button>
        <button
          className="btn btn-danger"
          type="button"
          disabled={busy || !leads.length}
          onClick={() => void remove(true)}
        >
          Listeyi temizle
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          Silince place kaydı da gider, sonraki keşif aynı işletmeyi yeniden getirir. Ticari ileti İYS onayı operatörün sorumluluğu.
        </span>
      </div>

      {error ? <p className="error-box">{error}</p> : null}

      {loading ? (
        <div className="card" style={{ marginTop: 8 }}><div className="skel" style={{ height: 160 }} /></div>
      ) : leads.length === 0 ? (
        <div className="card empty" style={{ marginTop: 8 }}>
          <strong>Kayıt yok</strong>
          Keşif ekranından alıcı işletme tarayın.
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-wexon" href="/ara">Keşfe git</a>
            <a className="btn btn-ghost" href="/kilavuz">Kılavuz</a>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every((l) => selected[l.id])}
                      onChange={(e) => {
                        if (e.target.checked) selectVisible(false);
                        else setSelected({});
                      }}
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th>İşletme</th>
                  <th>İletişim</th>
                  <th>Durum</th>
                  <th>Onaylı</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[lead.id])}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [lead.id]: e.target.checked }))}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 650 }}>{lead.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {[lead.district, lead.city].filter(Boolean).join(" · ")}
                        {lead.rating != null ? ` · ${lead.rating}` : ""}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{lead.address}</div>
                    </td>
                    <td>
                      <div>{lead.phone ? formatPhoneDisplay(lead.phone) : "—"}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        {lead.mapsUrl ? <a className="muted" href={lead.mapsUrl} target="_blank" rel="noreferrer">Maps</a> : null}
                        {lead.website ? <a className="muted" href={lead.website} target="_blank" rel="noreferrer">Web</a> : null}
                      </div>
                    </td>
                    <td>
                      <select className="status-select" value={lead.status} onChange={(e) => void patch(lead.id, { status: e.target.value })}>
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="checkbox" checked={lead.consented} onChange={(e) => void patch(lead.id, { consented: e.target.checked })} />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        defaultValue={lead.notes}
                        placeholder="kısa not"
                        onBlur={(e) => {
                          if (e.target.value !== lead.notes) void patch(lead.id, { notes: e.target.value });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lead-cards">
            {leads.map((lead) => (
              <article key={lead.id} className="card lead-card">
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[lead.id])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [lead.id]: e.target.checked }))}
                  />
                  <strong>{lead.name}</strong>
                </label>
                <span className="muted">{lead.address}</span>
                <span>{lead.phone ? formatPhoneDisplay(lead.phone) : "—"}</span>
                <LeadControls lead={lead} />
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
