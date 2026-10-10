// Tarayıcıda ve masaüstü programında çalışan görüşme motoru. Müşteriyi dinler (varsayılan: sesi doğrudan
// yapay zekâya gönderir; isteğe bağlı: Chrome ses tanıma), OpenRouter'dan cevabı doğal sesle akış halinde çalar,
// donmaya karşı yedeklere geçer. React'tan bağımsızdır.
import { toWav16kBase64, Vad, type VadEvent } from "./vad";

export type CallState = "idle" | "preparing" | "listening" | "thinking" | "ai" | "customer";
export type ChatMsg = { id: number; role: "ai" | "user" | "sys"; text: string };
export type EndReason = "manual" | "closing" | "voicemail";
export type CallConfig = {
  voiceMode: "natural" | "browser";
  voice: string;
  /** Premium ses: daha doğal ve akıllı (gpt-audio), görüşme başı ~25 sent. */
  premium?: boolean;
  browserVoice: string;
  mode: "cable" | "speaker";
  outDev: string;
  monDev: string;
  monitor: boolean;
  inDev: string;
  /** Netgsm ayarlıysa "Aramaya hazırla" numarayı santral üzerinden kendisi çevirir. */
  autoDial?: boolean;
  /** "model": müşterinin sesi doğrudan yapay zekâya gider (önerilen, masaüstünde de çalışır). "tarayici": Chrome ses tanıma. */
  hearing?: "model" | "tarayici";
};
export type LeadInfo = { isletme: string; telefon?: string; sektor: string; sehir: string; not: string };
type Listener = {
  onState: (s: CallState) => void;
  onMessages: (m: ChatMsg[]) => void;
  onInterim: (t: string) => void;
  onCost: (usd: number) => void;
  onLevel: (pct: number) => void;
  onEnded: (reason: EndReason) => void;
};
type HistMsg = { role: "user" | "assistant"; content: string };
/** Müşterinin bir cümlesi: ses kaydı + yazıya dökülmesi (arka planda) + geçmişteki yeri. */
type Heard = { audio: string; entry: HistMsg; text: Promise<string> };

// Müşteri AI konuşurken bunları derse sözünü kesme (onay sesleri)
const BACKCHANNEL_RE = /^(h[ıi]+( ?h[ıi]+)*|ıh[ıi]+|evet+|tamam+|aynen|anladım|peki|olur|tabii?|hmm+|h[ae]+|he ?he|doğru|haklısınız|evet evet|tamam tamam)$/i;
// Operatör / telesekreter anonsları
const VOICEMAIL_RE = /(başka bir görüşmede|şu anda meşgul|hat meşgul|cevap veremiyor|daha sonra tekrar deneyin|aradığınız (kişiye|numaraya)|şu anda ulaşılamıyor|ulaşılamamaktadır|sesli mesaj|telesekreter|sinyal sesinden sonra|kapsama alanı dışında|numara kullanılmamaktadır|geçici olarak hizmet dışı|mesajınızı bırak)/i;
// Müşterinin veda/teşekkür cevabı (Ece vedalaştıktan sonra)
const FAREWELL_RE = /(teşekkür|sağ ?ol|eyvallah|iyi çalışmalar|kolay gelsin|iyi günler|iyi akşamlar|görüşürüz|hoşça kal|tamam(dır)?|peki|anlaştık)/i;
// Ece vedalaşınca görüşme biter
const CLOSING_RE = /(kolay gelsin|iyi çalışmalar|iyi günler( dilerim)?|hoşça kalın|görüşmek üzere|iyi akşamlar)[.!]?\s*$/i;
const OPENER_STATUS = "(Karşı taraf telefonu açtı ve “Alo” dedi.)";
const COST_WARN_USD = 0.15;
const COST_WARN_PREMIUM_USD = 0.6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Görüşme sürüyor mu? Masaüstü programı ve sürüm uyarısı güncellemeyi buna göre bekletir. */
const aramaDurumu = (aktif: boolean) => { (window as unknown as { __wexonAramaAktif?: boolean }).__wexonAramaAktif = aktif; };
type SinkCtx = AudioContext & { setSinkId?: (id: string) => Promise<void> };
type SinkMedia = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

// ---------- 24 kHz PCM16 akış oynatıcı (birden fazla çıkışa aynı anda) ----------
export class PcmPlayer {
  private outs: { ctx: SinkCtx; next: number }[] = [];
  private sources = new Set<AudioBufferSourceNode>();
  private endAt = 0;
  private carry: Uint8Array | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  streaming = false;
  onIdle: (() => void) | null = null;

  async open(sinkIds: string[]) {
    await this.close();
    for (const id of sinkIds) {
      const ctx = new AudioContext({ sampleRate: 24000 }) as SinkCtx;
      if (id && ctx.setSinkId) await ctx.setSinkId(id).catch(() => undefined);
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      this.outs.push({ ctx, next: 0 });
    }
  }
  async close() {
    this.stop();
    for (const o of this.outs) await o.ctx.close().catch(() => undefined);
    this.outs = [];
  }
  get speaking() {
    return this.streaming || Boolean(this.outs[0] && this.outs[0].ctx.currentTime < this.endAt - 0.02);
  }
  push(b64: string) {
    let bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (this.carry) {
      const m = new Uint8Array(this.carry.length + bytes.length);
      m.set(this.carry); m.set(bytes, this.carry.length);
      bytes = m; this.carry = null;
    }
    if (bytes.length % 2) { this.carry = bytes.slice(-1); bytes = bytes.slice(0, -1); }
    if (!bytes.length || !this.outs.length) return;
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    this.outs.forEach((o, k) => {
      const buf = o.ctx.createBuffer(1, f.length, 24000);
      buf.copyToChannel(f, 0);
      const src = o.ctx.createBufferSource();
      src.buffer = buf; src.connect(o.ctx.destination);
      const yeniBaslangic = o.next <= o.ctx.currentTime;
      const t = yeniBaslangic ? o.ctx.currentTime + 0.25 : o.next;
      src.start(t); o.next = t + buf.duration;
      if (k === 0) this.endAt = o.next;
      this.sources.add(src);
      src.onended = () => this.sources.delete(src);
    });
    this.armIdle();
  }
  armIdle() {
    clearTimeout(this.idleTimer);
    if (!this.outs.length) return;
    const ms = Math.max(0, (this.endAt - this.outs[0].ctx.currentTime) * 1000) + 120;
    this.idleTimer = setTimeout(() => (this.speaking ? this.armIdle() : this.onIdle?.()), ms);
  }
  done() { this.streaming = false; this.carry = null; this.armIdle(); }
  stop() {
    clearTimeout(this.idleTimer);
    for (const s of this.sources) { try { s.stop(); } catch {} }
    this.sources.clear();
    this.streaming = false; this.carry = null; this.endAt = 0;
    for (const o of this.outs) o.next = 0;
  }
}

// ---------- tarayıcı ses tanıma tipleri ----------
type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlt };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; abort: () => void;
};
type SRCtor = new () => SR;
export function speechRecognitionCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type StreamOpts = {
  kind: "voice" | "text";
  messages: HistMsg[];
  signal?: AbortSignal;
  onAudio?: (b64: string) => void;
  onText?: (full: string) => void;
  fallback?: boolean;
  firstByteMs?: number;
  /** Müşterinin son sözü (16 kHz WAV, base64): yazıya çevrilmeden modele gider. */
  audio?: string;
};
class HttpError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export class CallEngine {
  private cfg!: CallConfig;
  private lead!: LeadInfo;
  private player = new PcmPlayer();
  private rec: SR | null = null;
  private history: HistMsg[] = [];
  private msgs: ChatMsg[] = [];
  private msgSeq = 0;
  private abort: AbortController | null = null;
  private finals = "";
  private interim = "";
  private interimIdx: number | null = null;
  private interimLast = "";
  private skipFinal = new Map<number, string>();
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private closingTimer: ReturnType<typeof setTimeout> | undefined;
  private nudges = 0;
  private lastUserAt = 0;
  private closing = false;
  private costWarned = false;
  private aiText = "";
  private opener: { chunks: string[]; text: string; ready: boolean; failed: boolean; ctrl: AbortController; promise?: Promise<void> } | null = null;
  private openerBusy = false;
  private afterOpener: HistMsg[] = [];
  private afterOpenerHeard: Heard | null = null;
  private mic: MediaStream | null = null;
  private meterCtx: AudioContext | null = null;
  private meterRaf = 0;
  private monAudio: SinkMedia | null = null;
  // Doğrudan dinleme (VAD)
  private listenCtx: AudioContext | null = null;
  private listenNode: ScriptProcessorNode | null = null;
  private vad: Vad | null = null;
  private uttDuringAi = false;
  private bargedIn = false;
  private aiQuietUntil = 0;
  active = false;
  callCost = 0;
  transcript: string[] = [];

  constructor(private on: Listener) {
    this.player.onIdle = () => this.onAiFinished();
  }

  // ---------- dışa açık ----------
  async start(cfg: CallConfig, lead: LeadInfo) {
    const byModel = (cfg.hearing ?? "model") === "model";
    const SRC = byModel ? null : speechRecognitionCtor();
    if (!byModel && !SRC) throw new Error("Bu tarayıcıda ses tanıma yok. Ses ayarlarından “Yapay zekâ dinlesin”i seç.");
    this.cfg = cfg; this.lead = lead;
    Object.assign(this, {
      history: [], msgs: [], transcript: [], finals: "", interim: "", nudges: 0, callCost: 0, aiText: "",
      closing: false, costWarned: false, openerBusy: false, afterOpener: [], lastUserAt: Date.now(),
    });
    this.emitMsgs(); this.on.onCost(0); this.on.onState("preparing");
    if (cfg.voiceMode === "natural") await this.player.open(this.sinkIds());
    this.active = true;
    aramaDurumu(true);
    this.prepareOpener();
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: cfg.inDev ? { exact: cfg.inDev } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (byModel) this.startListening(this.mic); else this.startMeter(this.mic);
      // Müşterinin sesini de kulaklığa ver
      if (cfg.monitor && cfg.mode === "cable" && cfg.monDev) {
        const a = new Audio() as SinkMedia;
        a.srcObject = this.mic;
        if (a.setSinkId) await a.setSinkId(cfg.monDev).catch(() => undefined);
        void a.play().catch(() => undefined);
        this.monAudio = a;
      }
    } catch (e) {
      if (byModel) {
        this.teardown();
        throw new Error("Müşterinin sesi gelen cihaz açılamadı (" + (e as Error).message + "). Ses ayarlarında “Müşterinin sesi nereden gelsin”i kontrol et.");
      }
    }
    if (SRC) this.startRecognition(SRC);
    this.on.onState("listening");
    this.sys("Hazır. Numarayı çevir; müşteri “Alo” deyince Ece cevap verir.");
  }

  end(reason: EndReason = "manual") {
    if (!this.active) return;
    this.sys(`Görüşme bitti · maliyet $${this.callCost.toFixed(4)}`);
    this.teardown();
    this.on.onEnded(reason);
  }

  /** Konuşma akışına bilgi satırı ekler. */
  note(text: string) { if (this.active) this.sys(text); }

  silence() {
    this.abort?.abort(); this.abort = null;
    this.stopSpeaking();
    if (this.active) this.on.onState("listening");
  }

  aiFirst() {
    void this.userTurn("(Karşı taraf telefonu açtı ama henüz bir şey söylemedi. Sadece kısaca selam ver, örneğin \"Merhaba, iyi günler\", ve cevabını bekle.)", true);
  }

  whisper(t: string) {
    t = t.trim(); if (!t || !this.active) return;
    this.history.push({ role: "user", content: `(Operatör talimatı, müşteriye söyleme, sadece uygula: ${t})` });
    this.sys("Talimat iletildi: " + t);
    if (!this.aiSpeaking() && !this.abort) void this.respond();
  }

  /** Ses denemesi: sistemin kendi sesini kulaklıktan dinlet. */
  static async testVoice(voice: string, sink: string, onCost: (c: number) => void, premium = false) {
    const p = new PcmPlayer();
    await p.open([sink]);
    p.streaming = true;
    const eng = new CallEngine({ onState() {}, onMessages() {}, onInterim() {}, onCost() {}, onLevel() {}, onEnded() {} });
    eng.cfg = { voice, premium } as CallConfig;
    eng.lead = { isletme: "Örnek İşletme", sektor: "", sehir: "", not: "" };
    try {
      await eng.stream({
        kind: "voice",
        messages: [{ role: "user", content: "(Ses denemesi: bu bir arama değil. Kendini Wexon'dan Ece olarak bir iki kısa cümleyle tanıt ve müsait olup olmadığını sor.)" }],
        onAudio: (b) => p.push(b),
      });
      onCost(eng.callCost);
      p.done();
      await new Promise<void>((r) => { p.onIdle = r; p.armIdle(); });
    } finally {
      await p.close();
    }
  }

  // ---------- iç işleyiş ----------
  private sinkIds() {
    const ids = [this.cfg.outDev || ""];
    if (this.cfg.monitor && this.cfg.mode === "cable" && this.cfg.monDev) ids.push(this.cfg.monDev);
    return ids;
  }
  private emitMsgs() { this.on.onMessages(this.msgs.map((m) => ({ ...m }))); }
  private push(role: ChatMsg["role"], text: string) {
    const m = { id: ++this.msgSeq, role, text };
    this.msgs.push(m); this.emitMsgs();
    return m;
  }
  private sys(text: string) { this.push("sys", text); }
  private addCost(c: number) {
    if (!c) return;
    this.callCost += c; this.on.onCost(this.callCost);
    if (this.active && !this.costWarned && this.callCost > (this.cfg.premium ? COST_WARN_PREMIUM_USD : COST_WARN_USD)) {
      this.costWarned = true;
      this.history.push({ role: "user", content: "(Operatör talimatı, müşteriye söyleme: görüşme uzadı. Kibarca toparla, gerekirse WhatsApp numarasını alıp görüşmeyi kapat.)" });
      this.sys("Görüşme uzadı, Ece'den toparlaması istendi.");
    }
  }
  private aiSpeaking() { return this.player.speaking || (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking); }
  private stopSpeaking() { this.player.stop(); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }

  private async stream(o: StreamOpts): Promise<string> {
    const ctrl = new AbortController();
    const outer = () => ctrl.abort();
    o.signal?.addEventListener("abort", outer);
    let gotFirst = false, full = "";
    const watchdog = setTimeout(() => { if (!gotFirst) ctrl.abort("timeout"); }, o.firstByteMs ?? 7000);
    try {
      const r = await fetch("/api/arama/chat", {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: o.kind, voice: this.cfg.voice, premium: this.cfg.premium === true, lead: this.lead, messages: o.messages, fallback: o.fallback, audio: o.audio }),
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new HttpError(j.error || r.statusText, r.status);
      }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let sse = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        sse += dec.decode(value, { stream: true });
        const lines = sse.split("\n"); sse = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          let j: { error?: { message?: string }; usage?: { cost?: number }; choices?: { delta?: { content?: string; audio?: { data?: string; transcript?: string } } }[] };
          try { j = JSON.parse(line.slice(6)); } catch { continue; }
          if (j.error) throw new Error(j.error.message || "model hatası");
          const d = j.choices?.[0]?.delta;
          if (d?.audio?.data) { gotFirst = true; o.onAudio?.(d.audio.data); }
          const piece = d?.audio?.transcript || d?.content || "";
          if (piece) { gotFirst = true; full += piece; o.onText?.(full); }
          if (j.usage?.cost != null) this.addCost(Number(j.usage.cost) || 0);
        }
      }
      return full.trim();
    } catch (e) {
      if (ctrl.signal.reason === "timeout" && !o.signal?.aborted) throw new Error("Model geç cevap verdi");
      throw e;
    } finally {
      clearTimeout(watchdog);
      o.signal?.removeEventListener("abort", outer);
    }
  }

  private async respond(heard?: Heard) {
    if (!this.active) return;
    this.abort?.abort();
    const ctrl = new AbortController(); this.abort = ctrl;
    clearTimeout(this.silenceTimer);
    this.on.onState("thinking");
    let live: ChatMsg | null = null, text = "";
    const show = (full: string) => {
      text = full; this.aiText = full;
      if (!live) live = this.push("ai", full); else { live.text = full; this.emitMsgs(); }
    };

    // 1) Doğal ses: gecikirse bir kez daha dene
    if (this.cfg.voiceMode === "natural") {
      for (let attempt = 0; attempt < 2 && !ctrl.signal.aborted; attempt++) {
        try {
          this.player.streaming = true;
          const full = await this.stream({
            kind: "voice", signal: ctrl.signal, firstByteMs: attempt ? 9000 : 6000,
            // Son söz ses olarak gider; geçmişteki yer tutucusu gönderilmez
            messages: heard ? this.history.filter((m) => m !== heard.entry) : this.history, audio: heard?.audio,
            onAudio: (b) => { this.on.onState("ai"); this.player.push(b); }, onText: show,
          });
          this.player.done();
          if (full) return this.finishTurn(full, live);
          throw new Error("boş cevap");
        } catch (e) {
          this.player.done();
          if (ctrl.signal.aborted) { if (text) this.finishTurn(text + " …", live); return; }
          if (e instanceof HttpError && e.status === 402) { this.sys(e.message); return; }
          this.sys((attempt ? "Doğal ses yine cevap vermedi" : "Doğal ses gecikti, tekrar deniyorum") + ` (${(e as Error).message}).`);
          if (text) break;
        }
      }
    }

    // Kablo modunda tarayıcı sesi telefona ulaşamaz (Windows varsayılan çıkışına gider) → yedek sesi kullanma
    if (this.cfg.voiceMode === "natural" && this.cfg.mode === "cable") {
      this.sys("Ece şu an konuşamıyor (yapay zekâ sesine ulaşılamadı). Görüşmeyi sen devral ya da Bitir'e bas.");
      this.on.onState("listening");
      if (this.abort === ctrl) this.abort = null;
      return;
    }
    // 2) Yedek / ücretsiz mod: metin modeli + tarayıcı sesi (cümle cümle)
    let buf = "";
    const flush = (force: boolean) => {
      let m: RegExpMatchArray | null;
      while ((m = buf.match(/^([\s\S]*?[.!?…])(\s+|$)/)) && (m[2] || force)) { this.browserSpeak(m[1]); buf = buf.slice(m[0].length); }
      if (force && buf.trim()) { this.browserSpeak(buf); buf = ""; }
    };
    // Metin modeli sesi duyamaz: önce yazıya dökülmesini bekle
    if (heard) await Promise.race([heard.text, sleep(5000)]);
    for (const fallback of [false, true]) {
      if (ctrl.signal.aborted) return;
      try {
        live = null; text = "";
        const full = await this.stream({
          kind: "text", messages: this.history, signal: ctrl.signal, fallback,
          onText: (f) => { const piece = f.slice(text.length); show(f); buf += piece; flush(false); },
        });
        flush(true);
        if (full) return this.finishTurn(full, live);
      } catch (e) {
        if (ctrl.signal.aborted) { if (text) this.finishTurn(text + " …", live); return; }
        if (e instanceof HttpError && e.status === 402) { this.sys(e.message); return; }
        this.sys((fallback ? "Yedek model de hata verdi: " : "Metin modeli hata verdi, yedeğe geçiliyor: ") + (e as Error).message);
      }
    }
    // 3) Hiçbir şey çalışmasa bile sessiz kalma
    const sorry = "Pardon, hat biraz cızırdadı, son söylediğinizi tekrar eder misiniz?";
    this.browserSpeak(sorry); this.finishTurn(sorry, null);
  }

  private finishTurn(full: string, live: ChatMsg | null) {
    if (live) { live.text = full; this.emitMsgs(); } else this.push("ai", full);
    this.history.push({ role: "assistant", content: full });
    this.transcript.push("AI: " + full);
    if (CLOSING_RE.test(full.trim()) && this.history.filter((m) => m.role === "assistant").length >= 2) this.closing = true;
    if (this.abort && !this.abort.signal.aborted) this.abort = null;
    if (!this.aiSpeaking()) this.onAiFinished();
  }

  // AI sustu → sessizlik kontrolü veya vedalaşma sonrası otomatik bitiş
  private onAiFinished() {
    this.aiText = "";
    this.aiQuietUntil = Date.now() + 350;
    if (!this.active || this.aiSpeaking() || this.abort) return;
    this.on.onState("listening");
    clearTimeout(this.silenceTimer);
    if (this.closing) {
      clearTimeout(this.closingTimer);
      this.closingTimer = setTimeout(() => {
        if (this.active && this.closing && !this.aiSpeaking() && !this.abort && !this.interim && !this.finals) {
          this.sys("Ece vedalaştı, görüşme otomatik bitirildi. Telefonu kapatabilirsin.");
          this.end("closing");
        }
      }, 5000);
      return;
    }
    this.silenceTimer = setTimeout(() => {
      if (!this.active || this.aiSpeaking() || this.abort || this.interim || this.finals) return;
      if (Date.now() - this.lastUserAt < 7000 || this.nudges >= 2) return;
      this.nudges++;
      void this.userTurn("(Müşteri birkaç saniyedir sessiz. Hattın açık olup olmadığını kısaca ve doğal şekilde kontrol et, ya da son sorunu farklı ve kısa şekilde tekrar sor.)", true);
    }, 8000);
  }

  private browserSpeak(text: string) {
    text = text.replace(/[*_#>`()[\]]/g, "").trim();
    if (!text || typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR"; u.rate = 1.05;
    const v = speechSynthesis.getVoices().find((x) => x.name === this.cfg.browserVoice)
      ?? speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("tr"));
    if (v) u.voice = v;
    u.onstart = () => this.on.onState("ai");
    u.onend = () => { if (!speechSynthesis.pending && !speechSynthesis.speaking) this.onAiFinished(); };
    speechSynthesis.speak(u);
  }

  // Açılış cümlesi, numara çevrilirken hazırlanır → müşteri "Alo" der demez çalar
  private prepareOpener() {
    const op = { chunks: [] as string[], text: "", ready: false, failed: false, ctrl: new AbortController(), promise: undefined as Promise<void> | undefined };
    this.opener = op;
    if (this.cfg.voiceMode !== "natural") {
      op.text = "Merhaba, iyi günler.";
      op.ready = true;
      return;
    }
    op.promise = this.stream({
      kind: "voice", messages: [{ role: "user", content: OPENER_STATUS }], signal: op.ctrl.signal, firstByteMs: 9000,
      onAudio: (b) => op.chunks.push(b),
    }).then((t) => { op.text = t; op.ready = Boolean(t && op.chunks.length); op.failed = !op.ready; })
      .catch(() => { op.failed = true; });
  }
  private async playOpener(user: string | HistMsg): Promise<boolean> {
    const op = this.opener; this.opener = null;
    if (!op) return false;
    if (!op.ready && !op.failed) { this.on.onState("thinking"); await Promise.race([op.promise, sleep(4000)]); }
    if (!op.ready) { op.ctrl.abort(); return false; }
    this.history.push(typeof user === "string" ? { role: "user", content: user } : user);
    if (this.cfg.voiceMode === "natural") {
      this.player.streaming = true;
      for (const c of op.chunks) this.player.push(c);
      this.player.done();
      this.on.onState("ai");
    } else this.browserSpeak(op.text);
    this.finishTurn(op.text, null);
    return true;
  }

  private async userTurn(text: string, isStatus = false) {
    if (!this.active) return;
    if (!isStatus) {
      this.push("user", text); this.transcript.push("Müşteri: " + text);
      this.lastUserAt = Date.now(); this.nudges = 0;
      this.closing = false; clearTimeout(this.closingTimer);
      if (VOICEMAIL_RE.test(text)) {
        this.sys("Telesekreter / operatör anonsu algılandı, görüşme kapatılıyor.");
        this.stopSpeaking();
        return this.end("voicemail");
      }
    }
    if (this.openerBusy) { this.afterOpener.push({ role: "user", content: text }); return; }
    if (this.opener && !this.history.some((m) => m.role === "assistant")) {
      this.openerBusy = true; this.afterOpener = [];
      const played = await this.playOpener(isStatus ? "(Karşı taraf telefonu açtı ama bir şey söylemedi.)" : text);
      this.openerBusy = false;
      if (played) {
        if (!this.afterOpener.length) return;
        this.history.push(...this.afterOpener);
        const h = this.afterOpenerHeard; this.afterOpener = []; this.afterOpenerHeard = null;
        return this.respond(h ?? undefined);
      }
      text = [text, ...this.afterOpener.map((m) => m.content)].join(" "); this.afterOpener = [];
    }
    this.history.push({ role: "user", content: text });
    void this.respond();
  }

  // ---------- doğrudan dinleme: ses algılama + sesi yapay zekâya gönderme ----------
  private startListening(stream: MediaStream) {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain(); mute.gain.value = 0; // işlemci çalışsın diye bağlı, ses çıkarmaz
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    const vad = new Vad({ sampleRate: ctx.sampleRate });
    let lastLevel = 0;
    node.onaudioprocess = (ev) => {
      if (!this.active) return;
      // Hoparlör modunda Ece kendi sesini duymasın (yarım çift yönlü)
      if (this.cfg.mode === "speaker" && (this.aiSpeaking() || Date.now() < this.aiQuietUntil)) {
        vad.reset(); this.interim = ""; return;
      }
      for (const e of vad.feed(new Float32Array(ev.inputBuffer.getChannelData(0)))) this.onVad(e, ctx.sampleRate);
      const now = performance.now();
      if (now - lastLevel > 80) { lastLevel = now; this.on.onLevel(vad.level); }
    };
    if (ctx.state === "suspended") void ctx.resume();
    this.listenCtx = ctx; this.listenNode = node; this.vad = vad;
  }

  private onVad(e: VadEvent, rate: number) {
    if (e.type === "start") {
      this.uttDuringAi = this.aiSpeaking();
      this.bargedIn = false;
      this.interim = "…";
      clearTimeout(this.silenceTimer); clearTimeout(this.closingTimer);
      if (!this.uttDuringAi) this.on.onState("customer");
      this.on.onInterim("duyuluyor…");
      return;
    }
    if (e.type === "progress") {
      // Müşteri Ece konuşurken 0,7 sn'den uzun konuşursa araya girmiştir → Ece hemen sussun
      if (this.uttDuringAi && !this.bargedIn && e.ms >= 700) {
        this.bargedIn = true;
        this.stopSpeaking(); this.abort?.abort(); this.abort = null;
        this.on.onState("customer");
      }
      return;
    }
    this.interim = ""; this.on.onInterim("");
    if (e.ms < 250) { if (!this.aiSpeaking() && !this.abort) this.on.onState("listening"); return; } // tık, nefes
    if (this.uttDuringAi && !this.bargedIn) return; // Ece konuşurken kısa "hı hı" → sözünü kesme
    void this.customerSpoke(toWav16kBase64(e.pcm, rate));
  }

  private async transcribe(audio: string): Promise<string> {
    try {
      const baglam = [...this.history].reverse().find((m) => m.role === "assistant")?.content ?? "";
      const r = await fetch("/api/arama/yazi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio, baglam }) });
      const j = (await r.json()) as { text?: string; maliyet?: number };
      if (!r.ok) return "";
      this.addCost(Number(j.maliyet) || 0);
      return (j.text || "").trim();
    } catch { return ""; }
  }

  private async customerSpoke(audio: string) {
    if (!this.active) return;
    const vedaSonrasi = this.closing;
    const entry: HistMsg = { role: "user", content: "(Müşteri konuştu; sözü ses kaydı olarak iletildi.)" };
    const bubble = this.push("user", "…");
    this.lastUserAt = Date.now(); this.nudges = 0;
    this.closing = false; clearTimeout(this.closingTimer);
    // Yazıya dökme arka planda: ekran, geçmiş, özet ve telesekreter tespiti için
    const text = this.transcribe(audio).then((t) => {
      bubble.text = t || "(anlaşılmadı)";
      entry.content = t || "(Müşterinin söylediği anlaşılmadı.)";
      if (t) this.transcript.push("Müşteri: " + t);
      this.emitMsgs();
      if (t && this.active && VOICEMAIL_RE.test(t)) {
        this.sys("Telesekreter / operatör anonsu algılandı, görüşme kapatılıyor.");
        this.stopSpeaking();
        this.end("voicemail");
      }
      return t;
    });
    const heard: Heard = { audio, entry, text };
    // Ece vedalaştıktan sonra müşteri "teşekkürler, iyi çalışmalar" dediyse konuşmayı yeniden başlatma
    if (vedaSonrasi) {
      const t = await Promise.race([text, sleep(3500).then(() => "")]);
      if (!this.active) return;
      if (!t || (t.length < 60 && FAREWELL_RE.test(t))) {
        this.history.push(entry);
        this.sys("Müşteri vedalaştı, görüşme bitirildi. Telefonu kapatabilirsin.");
        return this.end("closing");
      }
    }
    if (this.openerBusy) { this.afterOpener.push(entry); this.afterOpenerHeard = heard; return; }
    if (this.opener && !this.history.some((m) => m.role === "assistant")) {
      this.openerBusy = true; this.afterOpener = []; this.afterOpenerHeard = null;
      const played = await this.playOpener(entry);
      this.openerBusy = false;
      if (played) {
        if (!this.afterOpener.length) return;
        this.history.push(...this.afterOpener);
        const h = this.afterOpenerHeard; this.afterOpener = []; this.afterOpenerHeard = null;
        return this.respond(h ?? undefined);
      }
    }
    this.history.push(entry);
    void this.respond(heard);
  }

  // AI'ın kendi sesinin yankısı mı? (kelimelerin çoğu AI'ın şu an söylediği metinde geçiyorsa)
  private looksLikeEcho(t: string) {
    if (!this.aiText) return false;
    const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-zçğıöşüâîû0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const ai = new Set(norm(this.aiText)); const w = norm(t);
    if (!w.length) return true;
    return w.filter((x) => ai.has(x)).length / w.length >= 0.6;
  }

  private commit() {
    clearTimeout(this.commitTimer);
    const t = `${this.finals} ${this.interim}`.trim();
    this.finals = ""; this.interim = ""; this.on.onInterim("");
    if (t) void this.userTurn(t);
  }

  private startRecognition(SRC: SRCtor) {
    const rec = new SRC();
    rec.lang = "tr-TR"; rec.continuous = true; rec.interimResults = true;
    this.skipFinal = new Map();
    rec.onresult = (e) => {
      const speaker = this.cfg.mode === "speaker";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]; const t = r[0].transcript.trim();
        if (!t) continue;
        if (speaker && this.aiSpeaking()) continue; // hoparlör modunda kendi sesini duymasın
        if (this.aiSpeaking() && this.looksLikeEcho(t)) continue;
        if (r.isFinal) {
          let add = t;
          const done = this.skipFinal.get(i);
          if (done !== undefined) {
            this.skipFinal.delete(i);
            add = t.toLocaleLowerCase("tr").startsWith(done.toLocaleLowerCase("tr")) ? t.slice(done.length).trim() : "";
            if (!add) continue;
          }
          this.finals += (this.finals ? " " : "") + add;
        } else { interim += (interim ? " " : "") + t; this.interimIdx = i; this.interimLast = t; }
      }
      this.interim = interim;
      const heard = `${this.finals} ${interim}`.trim();
      if (!heard) return;
      // AI konuşurken gelen "hı hı / evet" gibi onay sesleri sözünü kesmesin
      if (this.aiSpeaking() && BACKCHANNEL_RE.test(heard.toLocaleLowerCase("tr").replace(/[.,!?]/g, "").trim())) {
        if (!interim) { this.finals = ""; this.on.onInterim(""); }
        return;
      }
      this.on.onInterim(heard);
      clearTimeout(this.silenceTimer);
      // Müşteri araya girdi → AI hemen sussun
      if (heard.length > 3 && (this.aiSpeaking() || this.abort)) { this.stopSpeaking(); this.abort?.abort(); this.abort = null; }
      this.on.onState("customer");
      clearTimeout(this.commitTimer);
      if (interim) {
        // Tarayıcı kesin sonucu geciktirirse 1 sn sabit kalan ara sonucu kesin say
        this.commitTimer = setTimeout(() => {
          if (this.interimIdx != null) this.skipFinal.set(this.interimIdx, this.interimLast);
          this.interimIdx = null; this.commit();
        }, 1000);
      } else this.commitTimer = setTimeout(() => this.commit(), 450);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") { this.sys("Mikrofon izni yok. Adres çubuğundaki kilit simgesinden izin ver."); this.end(); }
      else if (e.error === "audio-capture") this.sys("Mikrofon bulunamadı. Chrome'un mikrofon ayarını kontrol et (CABLE Output).");
      else if (e.error === "network") this.sys("Ses tanıma internet hatası, yeniden bağlanıyor…");
    };
    // Tarayıcı ses tanımayı ara ara kendisi kapatır → hemen yeniden başlat
    rec.onend = () => {
      if (!this.active || this.rec !== rec) return;
      setTimeout(() => {
        if (this.active && this.rec === rec) { this.skipFinal = new Map(); this.interimIdx = null; try { rec.start(); } catch {} }
      }, 150);
    };
    this.rec = rec;
    rec.start();
  }

  private startMeter(stream: MediaStream) {
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 80) {
        last = now;
        an.getByteTimeDomainData(buf);
        let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        this.on.onLevel(Math.min(100, peak * 1.6));
      }
      this.meterRaf = requestAnimationFrame(tick);
    };
    this.meterRaf = requestAnimationFrame(tick);
    this.meterCtx = ctx;
  }

  private teardown() {
    this.active = false;
    aramaDurumu(false);
    if (this.listenNode) { this.listenNode.onaudioprocess = null; this.listenNode.disconnect(); this.listenNode = null; }
    void this.listenCtx?.close().catch(() => undefined); this.listenCtx = null; this.vad = null;
    clearTimeout(this.commitTimer); clearTimeout(this.silenceTimer); clearTimeout(this.closingTimer);
    this.opener?.ctrl.abort(); this.opener = null;
    const rec = this.rec; this.rec = null;
    try { rec?.abort(); } catch {}
    this.abort?.abort(); this.abort = null;
    this.stopSpeaking();
    void this.player.close();
    if (this.monAudio) { this.monAudio.pause(); this.monAudio.srcObject = null; this.monAudio = null; }
    this.mic?.getTracks().forEach((t) => t.stop()); this.mic = null;
    cancelAnimationFrame(this.meterRaf);
    void this.meterCtx?.close().catch(() => undefined); this.meterCtx = null;
    this.on.onLevel(0); this.on.onInterim("");
    this.on.onState("idle");
  }
}
