// Konuşma algılamayı gerçek bir ses kaydıyla dener: iki cümle arasına sessizlik ve hat gürültüsü ekler,
// VAD'ın iki ayrı cümle bulup bulmadığını kontrol eder.  Kullanım: npx tsx scripts/verify-vad.mts kayit.wav
import fs from "node:fs";
import { toWav16kBase64, Vad } from "../src/lib/arama/vad.ts";

const file = process.argv[2];
const src = fs.readFileSync(file);
const rate = src.readUInt32LE(24);
const pcm16 = new Int16Array(src.buffer, src.byteOffset + 44, (src.length - 44) >> 1);
const speech = Float32Array.from(pcm16.slice(0, rate * 6), (v) => v / 32768); // ilk 6 sn konuşma

// 1 sn gürültü + konuşma + 1,5 sn gürültü + konuşma + 1,5 sn gürültü
const noise = (sec: number) => Float32Array.from({ length: Math.floor(rate * sec) }, () => (Math.random() * 2 - 1) * 0.004);
const parts = [noise(1), speech, noise(1.5), speech.slice(0, rate * 2), noise(1.5)];
const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
let off = 0; for (const p of parts) { all.set(p, off); off += p.length; }

const vad = new Vad({ sampleRate: rate });
const found: { at: number; ms: number }[] = [];
let t = 0;
for (let i = 0; i < all.length; i += 2048) {
  for (const e of vad.feed(all.slice(i, i + 2048))) {
    if (e.type === "end") found.push({ at: Math.round((t * 1000) / rate), ms: e.ms });
  }
  t += 2048;
}
console.log("bulunan cümleler:", found);
const ok = found.length >= 2 && found.every((f) => f.ms > 300);
const wav = toWav16kBase64(speech.slice(0, rate), rate);
console.log("wav base64 uzunluğu (1 sn):", wav.length, wav.startsWith("UklGR") ? "(RIFF başlığı doğru)" : "(HATALI)");
if (!ok || !wav.startsWith("UklGR")) { console.error("VAD TESTİ BAŞARISIZ"); process.exit(1); }
console.log("VAD TESTİ TAMAM");
