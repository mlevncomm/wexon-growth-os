"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CallEngine, speechRecognitionCtor, type CallConfig, type CallState, type ChatMsg, type EndReason } from "@/lib/arama/engine";
import { CALL_MARK, OUTCOMES, VOICES, type Outcome } from "@/lib/arama/shared";
import { statusLabel } from "@/lib/lead-status";
import { formatPhoneDisplay, isWhatsAppCapablePhone, normalizePhone } from "@/lib/phone";
import s from "./arama.module.css";

type QLead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  sector: string;
  district: string;
  city: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
  website: string;
  notes: string;
  attempts: number;
  pitch: string;
};
type Target = (QLead & { manual?: false }) | { manual: true; id: ""; name: string; phone: string; status: "yeni"; sector: string; district: string; city: string; notes: string; attempts: 0; rating: null; reviewCount: null; mapsUrl: ""; website: ""; pitch: "" };
type Brand = { name: string; vertical: string };
type TodayCall = { id: string; at: number; leadId: string; isletme: string; sonuc: string; maliyet: number; konusma: string };
type Data = {
  brand: Brand;
  leads: QLead[];
  focus: QLead | null;
  today: TodayCall[];
  stats: { bugun: number; bugunIlgilendi: number; bugunHarcama: number };
  keyReady: boolean;
  netgsmReady: boolean;
  balanceUsd: number | null;
};
type Phase = "ready" | "live" | "result";
type Device = { id: string; label: string };

const DEFAULT_CFG: CallConfig = { voiceMode: "natural", premium: true, hearing: "model", voice: "marin", browserVoice: "", mode: "cable", outDev: "", monDev: "", monitor: true, inDev: "" };
const CFG_KEY = "growth-os:arama:cfg";
const FILTERS = [
  { value: "", label: "Hepsi" },
  { value: "yeni", label: "Yeni" },
  { value: "geri_ara", label: "Geri ara" },
  { value: "yazildi", label: "Yazıldı" },
  { value: "ulasilamadi", label: "Açmadı" },
] as const;
const STATE_TEXT: Record<CallState, [string, string]> = {
  idle: ["Hazır", "“Aramaya hazırla”ya bas, sonra telefondan numarayı çevir."],
  preparing: ["Hazırlanıyor…", "Ece’nin açılış cümlesi hazırlanıyor."],
  listening: ["Dinliyor", "Numarayı çevir. Müşteri “Alo” deyince Ece konuşur."],
  thinking: ["Ece düşünüyor…", "Cevap hazırlanıyor."],
  ai: ["Ece konuşuyor", "Müşteri araya girerse Ece hemen susar."],
  customer: ["Müşteri konuşuyor", "Ece dinliyor."],
};
const QUICK = [
  ["Numarayı teyit et", "WhatsApp numarasını tekrar sor ve rakamları gruplayarak teyit et."],
  ["Teklifi hatırlat", "Teklifini tekrar, kısaca ve farklı bir cümleyle hatırlat."],
  ["Tekrar ettir", "Müşterinin son söylediğini anlamadın; kibarca tekrar etmesini iste."],
  ["Kapat", "Müşteriye kibarca teşekkür et ve görüşmeyi kapat."],
] as const;

function loadCfg(): CallConfig {
  try { return { ...DEFAULT_CFG, ...(JSON.parse(localStorage.getItem(CFG_KEY) || "{}") as Partial<CallConfig>) }; } catch { return DEFAULT_CFG; }
}
const waDigits = (p: string) => {
  const e = normalizePhone(p, "TR");
  return e && isWhatsAppCapablePhone(e) ? e.replace(/^\+/, "") : "";
};
const contactFromNotes = (notes: string) => /görüşülen: ([^·—\n]+)/.exec(notes)?.[1]?.trim() ?? "";
const lastCalls = (notes: string) => notes.split("\n").filter((l) => l.startsWith(CALL_MARK)).slice(0, 3).join("\n");

const timeTR = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const outcomeLabel = (v: string) => OUTCOMES.find((o) => o.value === v)?.label ?? v;

/** Görüşme sonrası WhatsApp takip mesajı. Açmayanlara Growth OS'un otomatik (Koç uyumlu) mesajı gider. */
function buildFollowUp(o: Outcome | "", t: { isletme: string; yetkili: string; geri: string; pitch: string }, brand: Brand | undefined) {
  const wexon = !brand || brand.vertical === "software";
  const firma = brand?.name || "Wexon";
  const hi = `Merhaba${t.yetkili ? " " + t.yetkili : ""}, bugün ${firma} olarak sizi aramıştık.`;
  const isl = t.isletme || "işletmeniz";
  const sign = wexon ? "\nwexon.dev" : "";
  if (o === "ilgilendi") {
    return wexon
      ? `${hi} Konuştuğumuz gibi ${isl} için ücretsiz örnek sitenizi hazırlıyoruz, birkaç gün içinde buradan göndereceğiz. Eklemek istediğiniz fotoğraf, logo veya menü olursa buraya atabilirsiniz. İyi çalışmalar!${sign}`
      : `${hi} Konuştuğumuz gibi bilgileri buradan iletiyoruz. Aklınıza takılan her şeyi buraya yazabilirsiniz. İyi çalışmalar!`;
  }
  if (o === "geri_ara") return `${hi} Konuştuğumuz gibi ${t.geri || "uygun bir zamanda"} tekrar arayacağız. İsterseniz bilgileri buradan da gönderebiliriz. İyi çalışmalar!${sign}`;
  if (o === "ulasilamadi") return t.pitch;
  return "";
}

export default function AramaUi() {
  // --- veri ---
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [withSite, setWithSite] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // --- görüşme ---
  const [phase, setPhase] = useState<Phase>("ready");
  const [callState, setCallState] = useState<CallState>("idle");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [callCost, setCallCost] = useState(0);
  const [whisper, setWhisper] = useState("");

  // --- sonuç ---
  const [sonuc, setSonuc] = useState<Outcome | "">("");
  const [whatsapp, setWhatsapp] = useState("");
  const [yetkili, setYetkili] = useState("");
  const [geriArama, setGeriArama] = useState("");
  const [ozet, setOzet] = useState("");
  const [takipEdit, setTakipEdit] = useState<string | null>(null);
  const [kuyrugaEdit, setKuyrugaEdit] = useState<boolean | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState("");

  // --- ayarlar ---
  const [cfg, setCfg] = useState<CallConfig>(loadCfg);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devices, setDevices] = useState<{ ins: Device[]; outs: Device[] }>({ ins: [], outs: [] });
  const [browserVoices, setBrowserVoices] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const engineRef = useRef<CallEngine | null>(null);
  const targetRef = useRef<Target | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  // Müşteriler ekranındaki "Ece ile ara" bağlantısından gelen işletme (?lead=…)
  const focusRef = useRef<string | null>(new URLSearchParams(window.location.search).get("lead"));

  const load = useCallback(async (fresh = false) => {
    try {
      const focusId = focusRef.current;
      const r = await fetch(`/api/arama?site=${withSite ? 1 : 0}${fresh ? "&fresh=1" : ""}${focusId ? `&lead=${encodeURIComponent(focusId)}` : ""}`, { cache: "no-store" });
      const j = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw new Error(j.error || "Liste alınamadı");
      setData(j); setError("");
      if (focusId) {
        focusRef.current = null;
        if (j.focus) { setTarget(j.focus); targetRef.current = j.focus; setYetkili(contactFromNotes(j.focus.notes)); }
        window.history.replaceState(null, "", "/arama");
      }
      return j;
    } catch (e) { setError((e as Error).message); return null; }
  }, [withSite]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [msgs, interim]);

  const runSummary = useCallback(async (eng: CallEngine) => {
    const t = targetRef.current;
    if (!eng.transcript.some((l) => l.startsWith("Müşteri:"))) {
      setSonuc("ulasilamadi"); setOzet("Müşteri konuşmadı / açmadı.");
      return;
    }
    setSummarizing(true);
    try {
      const r = await fetch("/api/arama/ozet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konusma: eng.transcript.join("\n"), isletme: t?.name ?? "", telefon: t?.phone ?? "" }),
      });
      const j = (await r.json()) as { error?: string; sonuc?: Outcome | ""; whatsapp?: string; yetkili?: string; geriArama?: string; istekler?: string; ozet?: string; maliyet?: number };
      if (!r.ok) throw new Error(j.error);
      if (j.sonuc) setSonuc(j.sonuc);
      if (j.whatsapp) setWhatsapp(j.whatsapp);
      if (j.yetkili) setYetkili(j.yetkili);
      if (j.geriArama) setGeriArama(j.geriArama);
      setOzet([j.ozet, j.istekler ? `İstekler: ${j.istekler}` : ""].filter(Boolean).join(" "));
      eng.callCost += Number(j.maliyet) || 0; setCallCost(eng.callCost);
    } catch (e) { setInfo("Özet çıkarılamadı: " + (e as Error).message); }
    setSummarizing(false);
  }, []);

  // Motor bir kez oluşturulur
  useEffect(() => {
    const eng = new CallEngine({
      onState: setCallState, onMessages: setMsgs, onInterim: setInterim, onCost: setCallCost, onLevel: setLevel,
      onEnded: (reason: EndReason) => {
        setPhase("result");
        if (reason === "voicemail") { setSonuc("ulasilamadi"); setOzet("Telesekreter / ulaşılamadı."); }
        else void runSummary(eng);
        void loadRef.current(true);
      },
    });
    engineRef.current = eng;
    return () => eng.end();
  }, [runSummary]);

  // Tarayıcı Türkçe sesleri (ücretsiz mod)
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const fill = () => setBrowserVoices(speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("tr")).map((v) => v.name));
    fill(); speechSynthesis.onvoiceschanged = fill;
  }, []);

  const saveCfg = (patch: Partial<CallConfig>) => setCfg((c) => {
    const n = { ...c, ...patch };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(n)); } catch {}
    return n;
  });

  const loadDevices = useCallback(async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach((t) => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      const map = (k: MediaDeviceKind) => all.filter((d) => d.kind === k).map((d) => ({ id: d.deviceId, label: d.label || d.deviceId }));
      const ins = map("audioinput"), outs = map("audiooutput");
      setDevices({ ins, outs });
      // Sanal kablolar kuruluysa boş alanları otomatik seç
      setCfg((c) => {
        const n = { ...c };
        if (!n.outDev) n.outDev = outs.find((d) => /Hi-Fi Cable Input|CABLE-A Input|VoiceMeeter Input/i.test(d.label))?.id ?? "";
        if (!n.inDev) n.inDev = ins.find((d) => /^CABLE Output/i.test(d.label))?.id ?? "";
        try { localStorage.setItem(CFG_KEY, JSON.stringify(n)); } catch {}
        return n;
      });
    } catch (e) { setInfo("Mikrofon izni verilmedi: " + (e as Error).message); }
  }, []);
  const hasCable = devices.ins.some((d) => /CABLE Output/i.test(d.label));

  // --- sıra ---
  const queue = useMemo(() => (data?.leads ?? []).filter((l) => !filter || l.status === filter), [data, filter]);

  function resetResult() {
    setSonuc(""); setWhatsapp(""); setYetkili(""); setGeriArama(""); setOzet("");
    setTakipEdit(null); setKuyrugaEdit(null); setInfo(""); setMsgs([]); setInterim(""); setCallCost(0);
    setPhase("ready");
  }
  function pick(l: Target | null) {
    if (phase === "live") return;
    if (phase === "result" && !confirm("Bu aramanın sonucu kaydedilmedi. Yine de başka işletmeye geçilsin mi?")) return;
    resetResult();
    setTarget(l); targetRef.current = l;
    if (l) setYetkili(contactFromNotes(l.notes));
  }
  function pickManual() {
    const phone = normalizePhone(manualPhone, "TR");
    if (!phone) return setInfo("Telefon numarası geçersiz.");
    pick({ manual: true, id: "", name: manualName.trim() || formatPhoneDisplay(phone), phone, status: "yeni", sector: "", district: "", city: "", notes: "", attempts: 0, rating: null, reviewCount: null, mapsUrl: "", website: "", pitch: "" });
    setManualName(""); setManualPhone("");
  }

  // --- görüşme ---
  async function start() {
    const eng = engineRef.current;
    if (!eng || !target || phase === "live") return;
    if (!data?.keyReady) return setInfo("OpenRouter anahtarı yok. Sistem ekranında OpenRouter anahtarını kaydet.");
    if (cfg.hearing === "tarayici" && !speechRecognitionCtor()) return setInfo("Bu programda Chrome ses tanıma yok. Ses ayarlarında “Yapay zekâ dinlesin”i seç.");
    resetResult(); setYetkili(contactFromNotes(target.notes)); setPhase("live");
    const note = [
      target.rating ? `Google’da ${target.rating} puan${target.reviewCount ? `, ${target.reviewCount} yorum` : ""}` : "",
      target.attempts ? `Daha önce ${target.attempts} kez arandı. Önceki görüşmeler: ${lastCalls(target.notes)}` : "",
      target.status === "yazildi" ? "Daha önce WhatsApp’tan tanıtım mesajı gönderildi ama dönüş olmadı." : "",
    ].filter(Boolean).join(" · ");
    try {
      await eng.start(cfg, { isletme: target.name, telefon: target.phone, sektor: target.sector, sehir: [target.district, target.city].filter(Boolean).join(", "), not: note });
    } catch (e) { setInfo((e as Error).message); setPhase("ready"); return; }
    // Netgsm ayarlıysa numarayı santral çevirir: önce bilgisayardaki dahili çalar, açınca müşteri aranır
    if (data.netgsmReady && cfg.autoDial) {
      try {
        const r = await fetch("/api/arama/netgsm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target.manual ? { phone: target.phone } : { leadId: target.id }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error);
        eng.note("Netgsm arıyor: bilgisayardaki dahili çalınca aç, ardından müşteri aranacak.");
      } catch (e) { eng.note("Netgsm araması başlatılamadı: " + (e as Error).message + " Numarayı elle çevirebilirsin."); }
    }
  }
  const end = () => engineRef.current?.end("manual");
  const sendWhisper = (t: string) => { engineRef.current?.whisper(t); setWhisper(""); };

  // --- sonuç ---
  const waTarget = whatsapp || target?.phone || "";
  const followDefault = buildFollowUp(sonuc, { isletme: target?.name ?? "", yetkili, geri: geriArama, pitch: target?.pitch ?? "" }, data?.brand);
  const takip = takipEdit ?? followDefault;
  const waOk = Boolean(waDigits(waTarget));
  const kuyruga = kuyrugaEdit ?? (Boolean(takip) && waOk && ["ilgilendi", "geri_ara", "ulasilamadi"].includes(sonuc));
  const waHref = waOk && takip ? `https://wa.me/${waDigits(waTarget)}?text=${encodeURIComponent(takip)}` : undefined;

  async function save() {
    if (!target || !sonuc) return;
    setSaving(true); setInfo("");
    try {
      const r = await fetch("/api/arama/sonuc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: target.id || undefined,
          manual: target.manual ? { name: target.name, phone: target.phone } : undefined,
          sonuc, whatsapp, yetkili, geriArama, ozet, maliyet: callCost,
          konusma: engineRef.current?.transcript.join("\n") ?? "",
          takipMesaji: takip, kuyruga,
        }),
      });
      const j = (await r.json()) as { error?: string; queued?: boolean; queueNote?: string };
      if (!r.ok) throw new Error(j.error);
      const savedId = target.id;
      const fresh = await load(true);
      const next = (fresh?.leads ?? []).find((l) => l.id !== savedId && (!filter || l.status === filter)) ?? null;
      setPhase("ready");
      pickAfterSave(next);
      setInfo(`Kaydedildi.${j.queued ? " Takip mesajı WhatsApp onay kuyruğuna eklendi." : ""}${j.queueNote ? " " + j.queueNote : ""}`);
    } catch (e) { setInfo("Kaydedilemedi: " + (e as Error).message); }
    setSaving(false);
  }
  function pickAfterSave(next: Target | null) {
    setSonuc(""); setWhatsapp(""); setGeriArama(""); setOzet(""); setTakipEdit(null); setKuyrugaEdit(null);
    setMsgs([]); setInterim(""); setCallCost(0);
    setTarget(next); targetRef.current = next;
    setYetkili(next ? contactFromNotes(next.notes) : "");
  }

  // --- klavye kısayolları ---
  const keys = useRef<{ start: () => Promise<void>; end: () => void; next: () => void; silence: () => void } | null>(null);
  useEffect(() => {
    keys.current = { start, end, next: () => pick(queue.find((l) => l.id !== target?.id) ?? null), silence: () => engineRef.current?.silence() };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current; if (!k) return;
      if (e.key === "F2") { e.preventDefault(); void k.start(); }
      else if (e.key === "F4") { e.preventDefault(); k.end(); }
      else if (e.key === "F8") { e.preventDefault(); k.next(); }
      else if (e.key === "Escape") k.silence();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const live = phase === "live";
  const [stTitle, stSub] = STATE_TEXT[callState];
  const firstRun = !cfg.outDev && cfg.mode === "cable";

  return (
    <div>
      <div className={s.top}>
        <div>
          <div className="page-kicker">Arama</div>
          <h1 className="page-title">Ece ile ara</h1>
          <p className="page-copy">Keşif’te bulunan işletmeleri Ece arar; sonuç Müşteriler’e, takip mesajı WhatsApp onay kuyruğuna düşer.</p>
        </div>
        <div className={s.topPills}>
          {data ? <span className={`pill ${data.balanceUsd != null && data.balanceUsd < 1 ? "warn" : "mute"}`}>Bakiye {data.balanceUsd != null ? `$${data.balanceUsd.toFixed(2)}` : "—"}</span> : null}
          {data ? <span className={`pill ${data.stats.bugunIlgilendi ? "ok" : "mute"}`}>Bugün {data.stats.bugun} arama · {data.stats.bugunIlgilendi} ilgilendi{data.stats.bugunHarcama ? ` · $${data.stats.bugunHarcama.toFixed(2)}` : ""}</span> : null}
          <button type="button" className={`btn btn-ghost ${s.gear}`} onClick={() => { setSettingsOpen(true); void loadDevices(); }}>Ses ayarları</button>
        </div>
      </div>

      {error ? <p className="error-box" style={{ marginBottom: 14 }}>{error}</p> : null}
      {data && !data.keyReady ? (
        <p className="notice" style={{ marginBottom: 14 }}>OpenRouter anahtarı yok. <Link href="/ayarlar">Sistem</Link> ekranında sağlayıcıyı OpenRouter seçip anahtarı kaydet.</p>
      ) : firstRun ? (
        <p className="notice" style={{ marginBottom: 14 }}>İlk kez mi kullanıyorsun? <button type="button" className="btn btn-ghost" style={{ minHeight: 30, marginLeft: 6 }} onClick={() => { setSettingsOpen(true); void loadDevices(); }}>Ses ayarlarını yap</button></p>
      ) : null}

      <div className={s.grid}>
        <div className={s.stack}>
          {/* --- arama kartı --- */}
          {!target ? (
            <div className={`card ${s.emptyCard}`}>
              <h2>Kimi arayalım?</h2>
              <p className="page-copy" style={{ margin: "0 auto" }}>Sağdaki sıradan bir işletme seç ya da sıradakini getir.</p>
              <div className={s.actions} style={{ justifyContent: "center" }}>
                <button type="button" className={`btn btn-mint ${s.bigBtn}`} style={{ flex: "0 1 280px" }} disabled={!queue.length} onClick={() => pick(queue[0] ?? null)}>
                  Sıradakini getir <span className={s.kbd}>F8</span>
                </button>
              </div>
              <div className={s.manual}>
                <label className="field"><span>İşletme adı</span><input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Elle arama için" /></label>
                <label className="field"><span>Telefon</span><input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="0 5xx xxx xx xx" /></label>
                <button type="button" className="btn btn-ghost" style={{ alignSelf: "end" }} onClick={pickManual}>Seç</button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className={s.leadHead}>
                <div className={s.ava} aria-hidden>{(target.name.trim()[0] || "?").toLocaleUpperCase("tr")}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 className={s.leadName}>{target.name}</h2>
                  <div className={s.leadMeta}>
                    <b style={{ color: "var(--ink)" }}>{formatPhoneDisplay(target.phone)}</b>
                    {target.sector ? <span>{target.sector}</span> : null}
                    {target.district || target.city ? <span>{[target.district, target.city].filter(Boolean).join(", ")}</span> : null}
                    {target.rating ? <span>★ {target.rating}{target.reviewCount ? ` (${target.reviewCount})` : ""}</span> : null}
                    {target.mapsUrl ? <a href={target.mapsUrl} target="_blank" rel="noopener noreferrer">Haritada aç</a> : null}
                  </div>
                </div>
                <span className={`pill ${target.status === "geri_ara" ? "warn" : "mute"}`}>{target.manual ? "Elle" : statusLabel(target.status)}</span>
              </div>
              {lastCalls(target.notes) ? <div className={s.history}>{lastCalls(target.notes)}</div> : null}

              <div className={s.stateBar} data-s={callState}>
                <span className={s.dot} />
                <div className={s.stateText}><b>{stTitle}</b><span>{stSub}</span></div>
                {live ? <div className={s.meter} title="Müşteri sesi seviyesi"><i style={{ width: `${level}%` }} /></div> : null}
                {callCost ? <span className="pill mute">${callCost.toFixed(3)}</span> : null}
              </div>

              <div className={s.actions}>
                {!live ? (
                  <button type="button" className={`btn btn-mint ${s.bigBtn}`} disabled={phase === "result" || !data?.keyReady} onClick={() => void start()}>
                    Aramaya hazırla <span className={s.kbd}>F2</span>
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => engineRef.current?.aiFirst()} title="Müşteri açtı ama konuşmuyorsa">Ece başlasın</button>
                    <button type="button" className="btn btn-ghost" onClick={() => engineRef.current?.silence()}>Sustur <span className={s.kbd}>Esc</span></button>
                    <button type="button" className={`btn btn-danger ${s.bigBtn}`} onClick={end}>Bitir <span className={s.kbd}>F4</span></button>
                  </>
                )}
                {!live && phase === "ready" ? <button type="button" className="btn btn-ghost" onClick={() => pick(null)}>Vazgeç</button> : null}
              </div>

              <div className={s.chat} ref={chatRef}>
                {msgs.map((m) => (
                  <div key={m.id} className={`${s.bubble} ${s[m.role]}`}>
                    {m.role !== "sys" ? <small>{m.role === "ai" ? "Ece" : "Müşteri"}</small> : null}
                    {m.text}
                  </div>
                ))}
              </div>
              {interim ? <div className={s.interim}>duyuluyor: {interim}</div> : null}

              {live ? (
                <>
                  <form className={s.whisper} onSubmit={(e) => { e.preventDefault(); sendWhisper(whisper); }}>
                    <input value={whisper} onChange={(e) => setWhisper(e.target.value)} placeholder="Ece’ye gizli talimat (müşteri duymaz)" />
                    <button type="submit" className="btn btn-ghost">Gönder</button>
                  </form>
                  <div className={s.quick}>
                    {QUICK.map(([label, text]) => <button key={label} type="button" className="btn btn-ghost" onClick={() => sendWhisper(text)}>{label}</button>)}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* --- sonuç kartı --- */}
          {phase === "result" && target ? (
            <div className="card">
              <div className="page-kicker">Sonuç {summarizing ? "· özet çıkarılıyor…" : ozet ? "· otomatik dolduruldu, kontrol et" : ""}</div>
              <div className={s.outcomes}>
                {OUTCOMES.map((o) => (
                  <button key={o.value} type="button"
                    className={`chip ${sonuc === o.value ? "on" : ""} ${o.value === "aranmasin" ? s.chipBad : ""}`}
                    onClick={() => setSonuc(o.value)}>{o.label}</button>
                ))}
              </div>
              <div className={s.fields}>
                <label className="field"><span>WhatsApp</span><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={target.phone ? formatPhoneDisplay(target.phone) : "05xx…"} /></label>
                <label className="field"><span>Görüşülen</span><input value={yetkili} onChange={(e) => setYetkili(e.target.value)} placeholder="Örn. Ahmet Bey" /></label>
                <label className="field"><span>Geri arama</span><input value={geriArama} onChange={(e) => setGeriArama(e.target.value)} placeholder="Örn. yarın 14:00" /></label>
              </div>
              <div className={s.fields2}>
                <label className="field"><span>Özet</span><textarea value={ozet} onChange={(e) => setOzet(e.target.value)} placeholder="Görüşme bitince otomatik dolar" /></label>
                <label className="field"><span>WhatsApp takip mesajı</span><textarea value={takip} onChange={(e) => setTakipEdit(e.target.value)} placeholder="Bu sonuç için mesaj yok" /></label>
              </div>
              <label className={s.toggleRow}>
                <input type="checkbox" checked={kuyruga} disabled={!waOk || !takip} onChange={(e) => setKuyrugaEdit(e.target.checked)} />
                <span className={`switch ${kuyruga ? "on" : ""}`}><i /></span>
                Takip mesajını WhatsApp kuyruğuna ekle <span className="muted">(gönderilmeden önce Mesaj ekranında onaylarsın)</span>
              </label>
              {!waOk ? <p className={s.note}>Bu numara WhatsApp’a uygun değil (sabit hat). Müşterinin cep numarasını WhatsApp alanına yaz.</p> : null}
              <div className={s.saveRow}>
                <button type="button" className={`btn btn-mint ${s.bigBtn}`} disabled={!sonuc || saving || summarizing} onClick={() => void save()}>
                  {saving ? "Kaydediliyor…" : "Kaydet ve sıradakine geç"}
                </button>
                <a className={`btn btn-ghost ${s.waBtn}`} href={waHref} target="_blank" rel="noopener noreferrer" aria-disabled={!waHref}>WhatsApp’ta aç</a>
              </div>
            </div>
          ) : null}
          {info ? <p className="notice">{info}</p> : null}
        </div>

        {/* --- sıra --- */}
        <div className={s.stack}>
        <aside className="card">
          <div className={s.queueHead}>
            <h2>Sıra</h2>
            <span className="pill mute">{queue.length} işletme</span>
          </div>
          <div className="seg" style={{ flexWrap: "wrap" }}>
            {FILTERS.map((f) => <button key={f.value} type="button" className={filter === f.value ? "on" : ""} onClick={() => setFilter(f.value)}>{f.label}</button>)}
          </div>
          <label className={s.siteToggle}>
            <input type="checkbox" checked={withSite} onChange={(e) => setWithSite(e.target.checked)} />
            <span className={`switch ${withSite ? "on" : ""}`}><i /></span>
            Sitesi olanları da göster
          </label>
          <div className={s.queueList}>
            {!data ? <div className="skel" style={{ height: 120 }} /> : queue.length === 0 ? (
              <div className="empty" style={{ padding: "24px 6px" }}>
                <strong>Aranacak işletme yok</strong>
                <Link href="/ara" style={{ color: "var(--teal)", fontWeight: 700 }}>Keşif</Link>’ten sitesi olmayan işletmeleri bul.
              </div>
            ) : queue.map((l) => (
              <button key={l.id} type="button" className={`${s.qItem} ${target?.id === l.id ? s.on : ""}`} onClick={() => pick(l)} disabled={live}>
                <b>{l.name}</b>
                <span>{[l.sector, l.district || l.city].filter(Boolean).join(" · ") || formatPhoneDisplay(l.phone)}</span>
                <span className={`pill ${l.status === "geri_ara" ? "warn" : l.status === "yeni" ? "ok" : "mute"}`}>
                  {statusLabel(l.status)}{l.attempts ? ` · ${l.attempts}` : ""}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* --- bugünkü aramalar --- */}
        {data?.today.length ? (
          <section className="card">
            <div className={s.queueHead}>
              <h2>Bugün</h2>
              <span className="pill mute">${data.stats.bugunHarcama.toFixed(3)}</span>
            </div>
            <div className={s.todayList}>
              {data.today.map((c) => (
                <details key={c.id} className={s.todayItem}>
                  <summary>
                    <span className={s.todayTime}>{timeTR(c.at)}</span>
                    <b>{c.isletme || "—"}</b>
                    <span className={`pill ${c.sonuc === "ilgilendi" ? "ok" : c.sonuc === "geri_ara" ? "warn" : c.sonuc === "aranmasin" ? "bad" : "mute"}`}>{outcomeLabel(c.sonuc)}</span>
                  </summary>
                  <div className={s.todayBody}>
                    {c.konusma ? c.konusma : "Döküm yok."}
                    <span className="muted">Maliyet ${c.maliyet.toFixed(4)}</span>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}
        </div>
      </div>

      {/* --- ses ayarları --- */}
      {settingsOpen ? (
        <div className={s.backdrop} onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className={`card ${s.modal}`} role="dialog" aria-label="Ses ayarları">
            <div className={s.queueHead}>
              <h2>Ses ayarları</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>Kapat</button>
            </div>
            {devices.ins.length && !hasCable && cfg.mode === "cable" ? (
              <p className="error-box">Sanal ses kablosu bulunamadı. vb-audio.com/Cable adresinden <b>VB-CABLE</b> ve <b>VB-CABLE A+B</b>’yi kurup bilgisayarı yeniden başlat. O zamana kadar “Hoparlör” moduyla deneyebilirsin.</p>
            ) : null}
            <div className={s.modalGrid}>
              <div className="seg">
                <button type="button" className={cfg.voiceMode === "natural" ? "on" : ""} onClick={() => saveCfg({ voiceMode: "natural" })}>Doğal ses</button>
                <button type="button" className={cfg.voiceMode === "browser" ? "on" : ""} onClick={() => saveCfg({ voiceMode: "browser" })}>Ücretsiz ses · robotik</button>
              </div>
              {cfg.voiceMode === "natural" ? (
                <div className="seg">
                  <button type="button" className={!cfg.premium ? "on" : ""} onClick={() => saveCfg({ premium: false })}>Standart · ucuz · ~3 sent</button>
                  <button type="button" className={cfg.premium ? "on" : ""} onClick={() => saveCfg({ premium: true })}>Premium · insan gibi · ~12–15 sent (önerilen)</button>
                </div>
              ) : null}
              <div className={s.row2}>
                {cfg.voiceMode === "natural" ? (
                  <label className="field"><span>Ece’nin sesi</span>
                    <select value={cfg.voice} onChange={(e) => saveCfg({ voice: e.target.value })}>
                      {VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="field"><span>Tarayıcı sesi</span>
                    <select value={cfg.browserVoice} onChange={(e) => saveCfg({ browserVoice: e.target.value })}>
                      <option value="">Otomatik</option>
                      {browserVoices.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" className="btn btn-ghost" style={{ alignSelf: "end" }} disabled={testing || cfg.voiceMode !== "natural"}
                  onClick={async () => {
                    setTesting(true);
                    try { await CallEngine.testVoice(cfg.voice, cfg.monDev, () => undefined, cfg.premium === true); } catch (e) { setInfo("Ses denemesi başarısız: " + (e as Error).message); }
                    setTesting(false);
                  }}>{testing ? "Çalıyor…" : "Sesi dinle"}</button>
              </div>
              {data?.netgsmReady ? (
                <label className={s.toggleRow} style={{ marginTop: 0 }}>
                  <input type="checkbox" checked={Boolean(cfg.autoDial)} onChange={(e) => saveCfg({ autoDial: e.target.checked })} />
                  <span className={`switch ${cfg.autoDial ? "on" : ""}`}><i /></span>
                  Numarayı Netgsm santral çevirsin (elle tuşlama yok)
                </label>
              ) : null}
              <label className="field"><span>Ece müşteriyi nasıl dinlesin</span>
                <select value={cfg.hearing ?? "model"} onChange={(e) => saveCfg({ hearing: e.target.value as CallConfig["hearing"] })}>
                  <option value="model">Yapay zekâ doğrudan dinlesin (önerilen · tonu ve duraksamayı da anlar)</option>
                  <option value="tarayici">Chrome ses tanıma (sadece Chrome’da)</option>
                </select>
              </label>
              <label className="field"><span>Bağlantı</span>
                <select value={cfg.mode} onChange={(e) => saveCfg({ mode: e.target.value as CallConfig["mode"] })}>
                  <option value="cable">Sanal kablo — telefon bilgisayara bağlı (önerilen)</option>
                  <option value="speaker">Hoparlör — telefonu bilgisayarın yanına koy (deneme)</option>
                </select>
              </label>
              <div className={s.row2}>
                <label className="field"><span>Ece’nin sesi nereye gitsin</span>
                  <select value={cfg.outDev} onChange={(e) => saveCfg({ outDev: e.target.value })}>
                    <option value="">Varsayılan hoparlör</option>
                    {devices.outs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label className="field"><span>Müşterinin sesi nereden gelsin</span>
                  <select value={cfg.inDev} onChange={(e) => saveCfg({ inDev: e.target.value })}>
                    <option value="">Varsayılan mikrofon</option>
                    {devices.ins.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
              </div>
              <label className={s.toggleRow} style={{ marginTop: 0 }}>
                <input type="checkbox" checked={cfg.monitor} onChange={(e) => saveCfg({ monitor: e.target.checked })} />
                <span className={`switch ${cfg.monitor ? "on" : ""}`}><i /></span>
                Görüşmeyi kulaklığımdan dinle
              </label>
              {cfg.monitor ? (
                <label className="field"><span>Kulaklık</span>
                  <select value={cfg.monDev} onChange={(e) => saveCfg({ monDev: e.target.value })}>
                    <option value="">Varsayılan</option>
                    {devices.outs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
              ) : null}
              <p className="notice" style={{ margin: 0 }}>
                <b>Kablo modunda:</b> Ece’nin sesi = <b>Hi-Fi Cable Input</b> (veya CABLE-A Input), müşteri = <b>CABLE Output</b>.
                Windows’ta varsayılan çıkış = <b>CABLE Input</b>, varsayılan giriş = <b>Hi-Fi Cable Output</b>. Wexon Growth OS masaüstü programı bunları kurulumda kendisi yapar.
                {cfg.hearing === "tarayici" ? <> Chrome ses tanımada ayrıca <b>chrome://settings/content/microphone</b> → <b>CABLE Output</b>.</> : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
