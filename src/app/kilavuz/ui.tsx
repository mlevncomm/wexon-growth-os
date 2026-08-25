"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchStats, type DashboardStats } from "@/lib/stats-client";

type Ready = {
  places: boolean;
  cloud: boolean;
  llm: boolean;
  ig: boolean;
  hosted: boolean;
};

const STEPS = [
  {
    n: "01",
    href: "/ayarlar",
    title: "Sistemi bağla",
    body: "Places anahtarı keşif için şart. Canlı WhatsApp için Cloud token + phone number ID. AI koç ve akıllı metin için Google Gemini. Instagram DM ayrı token ister.",
  },
  {
    n: "02",
    href: "/ara",
    title: "Keşif tarat",
    body: "İl / ilçe seçin, sektör işaretleyin, hedef sayıyı koyun. Places işletmeyi bir kez yazar; silinen kayıt sonraki taramada tekrar gelir.",
  },
  {
    n: "03",
    href: "/musteriler",
    title: "Listeyi temizle",
    body: "Durum, not ve İYS onay kutusunu işaretleyin. Telefonu olan, daha önce yazılmamış kayıtları seçip onaya alın.",
  },
  {
    n: "04",
    href: "/whatsapp",
    title: "Metni hazırla",
    body: "Açı seçin veya AI’ya not yazın. {ad} ve {ilçe} gönderimde dolar. Şablonu kaydedin; kuyruk bu metni kullanır.",
  },
  {
    n: "05",
    href: "/",
    title: "Kuyruktan onayla",
    body: "Sağ üst Kuyruk veya sol anahtar. Taslağı okuyun, düzenleyin, Onayla / Reddet. Onaysız mesaj gitmez. Cloud yoksa canlıda gönderim olmaz.",
  },
] as const;

const MODULES = [
  {
    href: "/",
    kicker: "Satış",
    title: "Panel",
    points: [
      "Günün keşif ve gönderim özeti. Sayılar birkaç saniyede dolar.",
      "Üst arama müşteri listesine gider. Tarih çipi son 30 gün göstergesidir, filtre değildir.",
      "Dışa aktar Excel indirir.",
    ],
  },
  {
    href: "/ara",
    kicker: "Satış",
    title: "Keşif",
    points: [
      "Sektör her şey olabilir. Web satıyorsan ‘Sitesi yok’, yenileme satıyorsan ‘Sitesi var’.",
      "Hedefi 10–20 tutun. Telefonu olmayanları alma açık kalsın.",
      "Hata görürseniz Cloud Console’da Places API (eski) açık olsun. Sistem’e AIza anahtarı yazın; New API kapalıysa uygulama eskiye düşer.",
    ],
  },
  {
    href: "/musteriler",
    kicker: "Satış",
    title: "Müşteriler",
    points: [
      "Filtrele → seç → Onaya al. Varsayılan şablon sektör + site (yeni site / yenileme); anahtar gerekmez.",
      "Yazıldı / ilgilenmiyor kuyruğa tekrar girmez.",
      "Silince place kaydı da gider; demo karışmasın diye sonraki keşif aynı mankeni yeniden getirebilir.",
    ],
  },
  {
    href: "/whatsapp",
    kicker: "Kanal",
    title: "Mesaj",
    points: [
      "Bu sitede QR okutun. Cloud varsa o gider; yoksa QR oturumu asıl kanaldır.",
      "Hazır metin anahtarsız çalışır. AI için Sistem’e Google Gemini yazın.",
      "Koç playbook’u doluysa AI o kurallara uyar.",
    ],
  },
  {
    href: "/koc",
    kicker: "Marka",
    title: "Koç",
    points: [
      "Türkçe konuşun: ton, yasak kelime, fiyat, CTA.",
      "Öğrenilenler kalıcı playbook olur. Fine-tune yok.",
      "Anahtar yoksa koç Sistem’e Gemini yazmanızı söyler. Kayıttan sonra Kontrol et ile deneyin.",
    ],
  },
  {
    href: "/instagram",
    kicker: "Kanal",
    title: "Instagram",
    points: [
      "Soğuk DM yok. Gelen kutu + onaylı cevap.",
      "Webhook canlı HTTPS ister; 127.0.0.1 Meta’da geçmez.",
      "Token ve user ID Sistem’dedir.",
    ],
  },
  {
    href: "/ayarlar",
    kicker: "Araçlar",
    title: "Sistem",
    points: [
      "Her işletme kendi Gemini / Places / WhatsApp anahtarını Sistem kılavuzundan alır; paylaşılmaz.",
      "Maskeli alanı değiştirmezseniz eski sır korunur.",
      "Günlük tavan ve 20–45 sn aralık spam görünümünü keser.",
    ],
  },
] as const;

export default function KilavuzPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);

  useEffect(() => {
    void fetchStats()
      .then(setStats)
      .catch(() => undefined);
    void fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Ready & { hasPlacesKey?: boolean; hasCloudToken?: boolean; hasLlmKey?: boolean; hasIgToken?: boolean }) => {
        setReady({
          places: Boolean(s.hasPlacesKey ?? s.places),
          cloud: Boolean(s.hasCloudToken ?? s.cloud),
          llm: Boolean(s.hasLlmKey ?? s.llm),
          ig: Boolean(s.hasIgToken ?? s.ig),
          hosted: Boolean(s.hosted),
        });
      })
      .catch(() => undefined);
  }, []);

  const leads = stats?.leadsTotal ?? 0;
  const queued = stats?.queued ?? 0;

  return (
    <div className="manual">
      <div className="page-kicker">Operatör</div>
      <h1 className="page-title">Baştan sona kullanım</h1>
      <p className="page-copy">
        Wexon Growth OS, su arıtma satışı için alıcı işletme bulur, listeyi temizler, WhatsApp metnini onayınıza sunar.
        Soğuk spam otomatik gitmez.
      </p>

      <div className="manual-status">
        <Status ok={Boolean(ready?.places)} label="Places" href="/ayarlar" />
        <Status ok={Boolean(ready?.cloud)} label="WhatsApp Cloud" href="/ayarlar" />
        <Status ok={Boolean(ready?.llm)} label="AI / Gemini" href="/ayarlar" />
        <Status ok={Boolean(ready?.ig)} label="Instagram" href="/instagram" />
        <Status ok={leads > 0} label={leads ? `${leads} müşteri` : "Keşif yok"} href="/ara" />
        <Status ok={queued > 0} label={queued ? `${queued} kuyruk` : "Kuyruk boş"} href="/?queue=1" />
      </div>

      <section className="hero" style={{ marginTop: 22 }}>
        <div>
          <div className="hero-kicker">Günün yolu</div>
          <div className="hero-val" style={{ fontSize: 28 }}>Keşfet → seç → onayla</div>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 13, maxWidth: "46ch" }}>
            Beş adım. Cloud yoksa keşif ve liste çalışır; mesaj kuyrukta bekler, canlıda gitmez.
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-mint" href="/ara">Keşfe git</Link>
          <Link className="btn btn-on-teal" href="/ayarlar">Sistem</Link>
        </div>
      </section>

      <ol className="manual-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Link href={s.href} className="manual-step">
              <em>{s.n}</em>
              <div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <div className="manual-grid">
        {MODULES.map((m) => (
          <article key={m.href} className="card panel">
            <div className="panel-head">
              <div>
                <div className="page-kicker">{m.kicker}</div>
                <h2>{m.title}</h2>
              </div>
              <Link className="btn btn-ghost" href={m.href}>Aç</Link>
            </div>
            <ul className="manual-points">
              {m.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <div className="page-kicker">Yasal</div>
            <h2>İYS ve ticari ileti</h2>
          </div>
        </div>
        <p className="panel-note">
          Ticari ileti İYS onayı operatörün sorumluluğudur. Onay kutusu kayıttadır; kutu işaretli değilken de kuyruğa alabilirsiniz —
          bu sizi yasal yükümlülükten kurtarmaz. Reddedilen taslak gitmez. Günlük tavan ve gecikme, spam görünümünü azaltır; izin yerine geçmez.
        </p>
      </section>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <div className="page-kicker">Telefon</div>
            <h2>Mobil kabuk</h2>
          </div>
        </div>
        <p className="panel-note">
          880 px altında sol menü hamburger olur. Alt şerit: Panel, Keşif, Liste, Mesaj, Daha. Keşif butonu yapışkan kalır.
          Kuyruk sağ üstten veya Daha → Kuyruk anahtarından açılır.
        </p>
      </section>
    </div>
  );
}

function Status({ ok, label, href }: { ok: boolean; label: string; href: string }) {
  return (
    <Link href={href} className={`manual-pill${ok ? " ok" : ""}`}>
      <i />
      {label}
    </Link>
  );
}
