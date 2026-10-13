"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./profil.module.css";

type Profil = { tenantId: string; ad: string; aciklama: string; harf: string; renk: string; sifreAyarli: boolean };

export default function ProfilPage() {
  const [profiller, setProfiller] = useState<Profil[]>([]);
  const [secili, setSecili] = useState<Profil | null>(null);
  const [pin, setPin] = useState("");
  const [hata, setHata] = useState("");
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ekran her açıldığında önceki profil kapanır: seçim ve şifre yeniden istenir
    void fetch("/api/profil", { method: "DELETE" })
      .then(() => fetch("/api/profil", { cache: "no-store" }))
      .then(async (r) => {
        if (r.status === 401) {
          window.location.replace("/giris");
          return;
        }
        if (r.status === 404) {
          window.location.replace("/");
          return;
        }
        const j = (await r.json()) as { profiller: Profil[] };
        setProfiller(j.profiller ?? []);
      })
      .catch(() => setHata("Profiller yüklenemedi. Bağlantıyı kontrol edin."));
  }, []);

  useEffect(() => {
    if (secili) pinRef.current?.focus();
  }, [secili]);

  function sec(p: Profil) {
    setSecili(p);
    setPin("");
    setHata("");
  }

  async function ac(e: FormEvent) {
    e.preventDefault();
    if (!secili || pin.length < 4) return;
    setBusy(true);
    setHata("");
    try {
      const r = await fetch("/api/profil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: secili.tenantId, pin }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Profil açılamadı");
      window.location.replace(j.git || "/ara");
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Profil açılamadı");
      setPin("");
      pinRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <div>
          <h1 className={styles.title}>Hangi işletmeyle çalışacaksınız?</h1>
          <p className={styles.sub}>Her profilin müşterileri, mesajları ve WhatsApp bağlantısı ayrıdır.</p>
        </div>

        <div className={styles.grid}>
          {profiller.map((p) => (
            <button
              key={p.tenantId}
              type="button"
              className={`${styles.profile}${secili?.tenantId === p.tenantId ? ` ${styles.on}` : ""}`}
              onClick={() => sec(p)}
              aria-pressed={secili?.tenantId === p.tenantId}
            >
              <span className={styles.avatar} style={{ background: p.renk }}>{p.harf}</span>
              <span className={styles.name}>{p.ad}</span>
              <span className={styles.desc}>{p.aciklama}</span>
            </button>
          ))}
        </div>

        {secili ? (
          <form className={styles.pinBox} onSubmit={(e) => void ac(e)}>
            <label htmlFor="pin" className={styles.sub}>{secili.ad} profil şifresi</label>
            <input
              id="pin"
              ref={pinRef}
              className={styles.pin}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              disabled={!secili.sifreAyarli}
            />
            <button className={styles.btn} type="submit" disabled={busy || pin.length < 4 || !secili.sifreAyarli}>
              {busy ? "Açılıyor…" : `${secili.ad} profilini aç`}
            </button>
            {!secili.sifreAyarli ? <div className={styles.error}>Bu profilin şifresi henüz ayarlanmamış.</div> : null}
            <div className={styles.error} role="alert">{hata}</div>
            <button type="button" className={styles.link} onClick={() => setSecili(null)}>Başka profil seç</button>
          </form>
        ) : (
          <div className={styles.error} role="alert">{hata}</div>
        )}
      </div>
    </div>
  );
}
