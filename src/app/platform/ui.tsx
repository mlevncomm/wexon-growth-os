"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type TenantUser = { id: string; email: string; createdAt: string };
type TenantCard = {
  id: string;
  slug: string;
  name: string;
  vertical: string;
  active: boolean;
  users: TenantUser[];
  userCount: number;
  leadCount: number;
};

const VERTICAL: Record<string, string> = {
  water: "Su arıtma",
  software: "Yazılım",
  yks: "YKS kursu",
};

export default function PlatformPage() {
  const [tenants, setTenants] = useState<TenantCard[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/platform", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Platform yüklenemedi");
    const rows = (json.tenants ?? []) as TenantCard[];
    setTenants(rows);
    setTenantId((prev) => prev || rows[0]?.id || "");
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "İşlem başarısız");
      if (body.action === "impersonate") {
        window.location.href = "/";
        return;
      }
      await load();
      if (body.action === "create-user") {
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setBusy("");
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    void post({ action: "create-user", email, password, tenantId }, "create");
  }

  return (
    <div className="plat">
      <header className="plat-top">
        <div>
          <div className="page-kicker" style={{ color: "rgba(255,255,255,0.55)" }}>Wexon altyapı</div>
          <h1>İşletme profilleri</h1>
          <p>Üç kasa aynı sitede. Destek girişi kayda düşer; gerçek WhatsApp bu ekrandan gitmez.</p>
        </div>
        <button
          className="btn btn-on-teal"
          type="button"
          onClick={() => {
            void fetch("/api/auth", { method: "DELETE" }).then(() => {
              window.location.href = "/giris";
            });
          }}
        >
          Çıkış
        </button>
      </header>

      {error ? <p className="error-box">{error}</p> : null}

      <div className="plat-grid">
        {tenants.map((t) => (
          <article key={t.id} className={`plat-card${!t.active ? " is-off" : ""}`}>
            <div className="plat-card-head">
              <div>
                <div className="page-kicker">{VERTICAL[t.vertical] ?? t.vertical}</div>
                <h2>{t.name}</h2>
              </div>
              <span className={`pill ${t.active ? "ok" : "mute"}`}>{t.active ? "Açık" : "Kapalı"}</span>
            </div>
            <p className="plat-meta">
              {t.leadCount} müşteri · {t.users.length} kullanıcı
            </p>
            <ul className="plat-users">
              {t.users.length ? (
                t.users.map((u) => <li key={u.id}>{u.email}</li>)
              ) : (
                <li className="muted">Henüz kullanıcı yok</li>
              )}
            </ul>
            <div className="plat-actions">
              <button
                className="btn btn-wexon"
                type="button"
                disabled={!t.active || busy === `in-${t.id}`}
                onClick={() => void post({ action: "impersonate", tenantId: t.id }, `in-${t.id}`)}
              >
                {busy === `in-${t.id}` ? "Giriliyor…" : "Destek için gir"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy === `tg-${t.id}`}
                onClick={() => void post({ action: "toggle", tenantId: t.id, active: !t.active }, `tg-${t.id}`)}
              >
                {t.active ? "Kapat" : "Aç"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="card plat-form">
        <div className="page-kicker">Kullanıcı</div>
        <h2 style={{ margin: "6px 0 8px", fontSize: 22 }}>İşletme hesabı aç</h2>
        <p className="page-copy">Şifreyi siz belirlersiniz; kişiye ayrı iletin. Kayıt açık değil.</p>
        <form className="plat-fields" onSubmit={onCreate}>
          <label className="field">
            <span>İşletme</span>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>E-posta</span>
            <input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="iris.p@example.org"
              required
            />
          </label>
          <label className="field">
            <span>Şifre</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="En az 8 karakter"
              required
            />
          </label>
          <button className="btn btn-wexon" type="submit" disabled={busy === "create"}>
            {busy === "create" ? "Ekleniyor…" : "Hesap oluştur"}
          </button>
        </form>
      </section>
    </div>
  );
}
