// Konuşma algılama (VAD): telefon hattından gelen sesi 20 ms'lik parçalarda ölçer,
// konuşmanın başladığı ve bittiği anı bulur. Arka plan gürültüsüne kendini uyarlar.
// Tarayıcıdan bağımsızdır; hem sayfada hem testte çalışır.

export type VadOptions = {
  sampleRate: number;
  /** Konuşma sayılması için gereken kesintisiz ses (ms). */
  minSpeechMs?: number;
  /** Bu kadar sessizlik olunca cümle bitti sayılır (ms). */
  endSilenceMs?: number;
  /** Konuşma başlamadan önceki sesten ne kadarı kayda eklensin (ms). */
  preRollMs?: number;
  /** Tek cümle en fazla bu kadar sürebilir (ms). */
  maxUtteranceMs?: number;
  /** En düşük ses eşiği (RMS, 0–1). */
  minLevel?: number;
  /** Eşik = gürültü tabanı × bu oran. */
  ratio?: number;
};

export type VadEvent =
  | { type: "start" }
  | { type: "progress"; ms: number }
  | { type: "end"; pcm: Float32Array; ms: number };

const FRAME_MS = 20;

export class Vad {
  private o: Required<VadOptions>;
  private frameLen: number;
  private carry = new Float32Array(0);
  private noise = 0;
  private frames = 0;
  private speaking = false;
  private candidate = 0;
  private silence = 0;
  private buf: Float32Array[] = [];
  private pre: Float32Array[] = [];
  /** Son ölçülen ses seviyesi (0–100), seviye göstergesi için. */
  level = 0;

  constructor(opts: VadOptions) {
    this.o = {
      minSpeechMs: 100, endSilenceMs: 650, preRollMs: 300, maxUtteranceMs: 25_000, minLevel: 0.012, ratio: 3, ...opts,
    };
    this.frameLen = Math.round((this.o.sampleRate * FRAME_MS) / 1000);
  }

  reset() {
    this.speaking = false; this.candidate = 0; this.silence = 0; this.buf = []; this.pre = [];
  }

  feed(input: Float32Array): VadEvent[] {
    const events: VadEvent[] = [];
    let data = input;
    if (this.carry.length) {
      data = new Float32Array(this.carry.length + input.length);
      data.set(this.carry); data.set(input, this.carry.length);
    }
    let i = 0;
    for (; i + this.frameLen <= data.length; i += this.frameLen) {
      const frame = data.slice(i, i + this.frameLen);
      this.frame(frame, events);
    }
    this.carry = data.slice(i);
    return events;
  }

  private frame(frame: Float32Array, events: VadEvent[]) {
    let sum = 0;
    for (let k = 0; k < frame.length; k++) sum += frame[k] * frame[k];
    const rms = Math.sqrt(sum / frame.length);
    this.level = Math.min(100, rms * 400);
    this.frames++;
    // Gürültü tabanı: ilk 300 ms ile başla, sonra sadece sessizken yavaşça güncelle
    if (this.frames <= 15) this.noise = this.frames === 1 ? rms : Math.min(this.noise, rms) * 0.5 + this.noise * 0.5;
    const thr = Math.max(this.o.minLevel, this.noise * this.o.ratio);

    if (!this.speaking) {
      this.pre.push(frame);
      const maxPre = Math.ceil(this.o.preRollMs / FRAME_MS);
      if (this.pre.length > maxPre) this.pre.shift();
      if (rms > thr) this.candidate++;
      else {
        this.candidate = 0;
        this.noise = this.noise * 0.97 + rms * 0.03;
      }
      if (this.candidate * FRAME_MS >= this.o.minSpeechMs) {
        this.speaking = true; this.silence = 0;
        this.buf = [...this.pre]; this.pre = [];
        events.push({ type: "start" });
      }
      return;
    }

    this.buf.push(frame);
    // Konuşma içinde eşik biraz düşük tutulur (kelime aralarında kesilmesin)
    if (rms > thr * 0.6) this.silence = 0;
    else this.silence += FRAME_MS;
    const ms = this.buf.length * FRAME_MS;
    events.push({ type: "progress", ms });
    if (this.silence >= this.o.endSilenceMs || ms >= this.o.maxUtteranceMs) {
      // Sondaki sessizliğin çoğunu at (200 ms kalsın)
      const drop = Math.max(0, Math.floor((this.silence - 200) / FRAME_MS));
      const keep = this.buf.slice(0, this.buf.length - drop);
      const pcm = new Float32Array(keep.reduce((n, f) => n + f.length, 0));
      let off = 0;
      for (const f of keep) { pcm.set(f, off); off += f.length; }
      const spokenMs = (keep.length * FRAME_MS) - Math.min(this.o.preRollMs, keep.length * FRAME_MS);
      events.push({ type: "end", pcm, ms: Math.max(0, spokenMs) });
      this.reset();
    }
  }
}

/** Float32 ses → 16 kHz mono 16 bit WAV (base64). Modele gönderilecek boyutu küçültür. */
export function toWav16kBase64(pcm: Float32Array, srcRate: number): string {
  const ratio = srcRate / 16000;
  const n = Math.floor(pcm.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    // Basit ortalama ile alçak geçiren örnekleme
    const a = Math.floor(i * ratio), b = Math.min(pcm.length, Math.floor((i + 1) * ratio));
    let s = 0; for (let k = a; k < b; k++) s += pcm[k];
    const v = b > a ? s / (b - a) : pcm[a] || 0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  const bytes = new Uint8Array(44 + out.byteLength);
  const dv = new DataView(bytes.buffer);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
  str(0, "RIFF"); dv.setUint32(4, 36 + out.byteLength, true); str(8, "WAVE"); str(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true);
  dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, "data");
  dv.setUint32(40, out.byteLength, true);
  bytes.set(new Uint8Array(out.buffer), 44);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
