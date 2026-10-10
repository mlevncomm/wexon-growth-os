"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhoneDisplay, isWhatsAppCapablePhone, normalizePhone } from "@/lib/phone";

export type MesajLead = { id: string; name: string; phone: string; notes: string; status: string };
type Sablon = { id: string; name: string; body: string };
type Tur = "tasarim" | "tanitim" | "takip" | `kayitli:${string}`;

const AD_KEY = "growth-os:mesaj:ad";

function hazirMesaj(tur: Tur, o: { isletme: string; ad: string; firma: string; link: string }) {
  const ben = `${o.ad ? `ben ${o.ad}, ` : ""}${o.firma}`;
  if (tur === "tasarim") {
    return o.link
      ? `Merhaba, ${ben}. ${o.isletme} için bir web sitesi tasarladım, şuradan bakabilirsiniz:\n${o.link}\n\nBeğenirseniz birkaç gün içinde kendi adınıza yayına alabiliriz. Aklınıza takılan her şeyi buradan sorabilirsiniz.`
      : `Merhaba, ${ben}. ${o.isletme} için bir web sitesi tasarımı hazırladım. Size buradan göndermemi ister misiniz? Bir bakın, beğenmezseniz hiçbir ücreti yok.`;
  }
  if (tur === "tanitim") {
    return `Merhaba, ${ben}. Google Haritalar'da ${o.isletme} işletmenize denk geldim, bir web siteniz görünmüyor. İşletmenize özel bir site tasarlayıp size göstermemi ister misiniz? Beğenmezseniz hiçbir ücreti yok.`;
  }
  if (tur === "takip") {
    return `Merhaba, ${o.ad ? `ben ${o.ad}, ` : ""}geçen gün ${o.isletme} için yazmıştım. Tasarıma bakma fırsatınız oldu mu? Merak ettiğiniz bir şey varsa buradan yazabilirsiniz.`;
  }
  return "";
}

const waDigits = (p: string) => {
  const e = normalizePhone(p, "TR");
  return e && isWhatsAppCapablePhone(e) ? e.replace(/^\+/, "") : "";
};

export function WhatsAppPenceresi({ lead, firma, onClose, onSent }: {
  lead: MesajLead;
  firma: string;
  onClose: () => void;
  onSent: (updated: MesajLead) => void;
}) {
  const [tur, setTur] = useState<Tur>(lead.status === "yazildi" ? "takip" : "tasarim");
  const [link, setLink] = useState("");
  const [ad, setAd] = useState(() => { try { return localStorage.getItem(AD_KEY) ?? ""; } catch { return ""; } });
  const [numara, setNumara] = useState(isWhatsAppCapablePhone(lead.phone) ? lead.phone : "");
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [sablonlar, setSablonlar] = useState<Sablon[]>([]);
  const [bilgi, setBilgi] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((rows: Sablon[]) => setSablonlar(Array.isArray(rows) ? rows.filter((s) => s.body?.trim()) : [])).catch(() => undefined);
  }, []);
  useEffect(() => {
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [onClose]);

  const otomatik = useMemo(() => {
    if (tur.startsWith("kayitli:")) {
      const s = sablonlar.find((x) => `kayitli:${x.id}` === tur);
      return (s?.body ?? "").replaceAll("{ad}", lead.name).replaceAll("{isletme}", lead.name).replaceAll("{ilçe}", "").replaceAll("{link}", link);
    }
    return hazirMesaj(tur, { isletme: lead.name, ad: ad.trim(), firma: firma || "Wexon yazılım stüdyosundan", link: link.trim() });
  }, [tur, sablonlar, lead.name, ad, firma, link]);
  const mesaj = duzenlenen ?? otomatik;
  const digits = waDigits(numara);

  function turSec(t: Tur) { setTur(t); setDuzenlenen(null); }

  async function kaydet(etiket: string) {
    const tarih = new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
    const notes = [`💬 ${tarih} · WhatsApp: ${etiket}`, lead.notes].filter(Boolean).join("\n").slice(0, 8000);
    const body: Record<string, string> = { notes };
    if (lead.status === "yeni") body.status = "yazildi";
    if (numara && normalizePhone(numara, "TR") !== lead.phone) body.phone = numara;
    const r = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) onSent((await r.json()) as MesajLead);
  }

  async function ac(masaustu: boolean) {
    if (!digits || !mesaj.trim()) return;
    try { localStorage.setItem(AD_KEY, ad.trim()); } catch {}
    const metin = encodeURIComponent(mesaj.trim());
    const url = masaustu ? `whatsapp://send?phone=${digits}&text=${metin}` : `https://wa.me/${digits}?text=${metin}`;
    window.open(url, "_blank", "noopener");
    const etiket = tur === "tasarim" ? "Web sitesi tasarladım" : tur === "tanitim" ? "Tanıtım" : tur === "takip" ? "Takip" : (sablonlar.find((x) => `kayitli:${x.id}` === tur)?.name ?? "Şablon");
    await kaydet(etiket);
    onClose();
  }

  const chip = (t: Tur, label: string) => (
    <button key={t} type="button" className={`chip ${tur === t ? "on" : ""}`} onClick={() => turSec(t)}>{label}</button>
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.32)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div className="card" role="dialog" aria-label="WhatsApp'tan yaz" style={{ width: "min(620px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="page-kicker">WhatsApp’tan yaz</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 21, letterSpacing: "-0.03em" }}>{lead.name}</h2>
            <div className="muted" style={{ fontSize: 13 }}>{lead.phone ? formatPhoneDisplay(lead.phone) : "Telefon yok"}</div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Kapat</button>
        </div>

        {!isWhatsAppCapablePhone(lead.phone) ? (
          <p className="notice" style={{ margin: 0 }}>Bu numara sabit hat, WhatsApp’ı yok. İşletmenin cep numarasını biliyorsan aşağıya yaz.</p>
        ) : null}

        <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chip("tasarim", "Web sitesi tasarladım")}
          {chip("tanitim", "Tanıtım")}
          {chip("takip", "Takip")}
          {sablonlar.slice(0, 4).map((s) => chip(`kayitli:${s.id}`, s.name))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field"><span>Adın (mesajda)</span><input value={ad} onChange={(e) => { setAd(e.target.value); setDuzenlenen(null); }} placeholder="Örn. Mehmet" /></label>
          <label className="field"><span>WhatsApp numarası</span><input value={numara} onChange={(e) => setNumara(e.target.value)} placeholder="05xx xxx xx xx" /></label>
        </div>
        {tur === "tasarim" || tur.startsWith("kayitli:") ? (
          <label className="field"><span>Tasarım linki (isteğe bağlı)</span><input value={link} onChange={(e) => { setLink(e.target.value); setDuzenlenen(null); }} placeholder="https://… (yoksa boş bırak)" /></label>
        ) : null}

        <label className="field">
          <span>Mesaj (istediğin gibi düzelt)</span>
          <textarea value={mesaj} onChange={(e) => setDuzenlenen(e.target.value)} style={{ minHeight: 150 }} />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="btn btn-mint" style={{ minHeight: 48, flex: "1 1 220px" }} disabled={!digits || !mesaj.trim()} onClick={() => void ac(false)}>
            WhatsApp’ta aç
          </button>
          <button type="button" className="btn btn-ghost" disabled={!digits || !mesaj.trim()} onClick={() => void ac(true)} title="Bilgisayardaki WhatsApp uygulamasında açar">
            Masaüstü WhatsApp
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => { void navigator.clipboard.writeText(mesaj); setBilgi("Mesaj kopyalandı"); }}>Kopyala</button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          {bilgi || (digits ? "WhatsApp mesaj yazılmış halde açılır; göndermek ve konuşmak sende. Müşteri “Yazıldı” olarak işaretlenir." : "Geçerli bir cep numarası gerekli.")}
        </p>
      </div>
    </div>
  );
}
