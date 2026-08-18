"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth.module.css";

function nextPath() {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("wexon_admin_email");
    if (saved) setEmail(saved);
    void fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean }) => {
        if (j.ok) router.replace(nextPath());
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Giriş olmadı");
      window.localStorage.setItem("wexon_admin_email", email.trim().toLowerCase());
      router.replace(nextPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş olmadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <aside className={styles.brand}>
          <div className={styles.mesh} aria-hidden />
          <div className={styles.brandInner}>
            <div className={styles.mark}>Wexon Growth OS</div>
            <div className={styles.brandCopy}>
              <h1>Operatör paneline hoş geldiniz</h1>
              <p>Giriş yapın, ardından WhatsApp ve Instagram kanallarını sırayla bağlayın.</p>
            </div>
            <ol className={styles.steps}>
              <li className={styles.on}>
                <span>1</span>
                Admin girişi
              </li>
              <li>
                <span>2</span>
                WhatsApp Cloud bağla
              </li>
              <li>
                <span>3</span>
                Instagram DM bağla
              </li>
            </ol>
          </div>
        </aside>

        <main className={styles.panel}>
          <form className={styles.form} onSubmit={(e) => void submit(e)}>
            <header className={styles.head}>
              <h2>Admin girişi</h2>
              <p>Yalnızca yetkili operatör. Şifre ortam değişkeninde durur.</p>
            </header>

            {error ? <p className={styles.alert}>{error}</p> : null}

            <label className={styles.field}>
              <span>E-posta</span>
              <input
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="admin@sirketiniz.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Şifre</span>
              <div className={styles.pass}>
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Operatör şifresi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.eye}
                  aria-label={showPass ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <em>En az 8 karakter</em>
            </label>

            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? "Giriliyor…" : "Panele gir"}
            </button>

            <p className={styles.foot}>Girişten sonra Sistem ekranından kanalları bağlarsınız.</p>
          </form>
        </main>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2.2 12C4 7 8.6 4 12 4s8 3 9.8 8c-1.8 5-6.4 8-9.8 8s-8-3-9.8-8z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" />
      <path d="M9.9 5.1A10.5 10.5 0 0121 12c-.6 1-1.4 2-2.4 2.9M6.1 6.1C4.4 7.4 3.1 9.1 2.2 12c1.8 5 6.4 8 9.8 8 1.6 0 3.2-.5 4.6-1.4" />
    </svg>
  );
}
