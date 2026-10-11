import { categoryById, type CategoryId } from "./categories";
import type { CustomerContext } from "./context";
import { profileFor } from "./profiles";

// Deterministik mesaj kalite kontrolü (100 puan). Bu puan sistemin kendi değerlendirmesidir,
// cevap ya da dönüşüm ölçümü değildir. "blockers" puan ne olursa olsun gönderimi engeller.

export type QualityBreakdown = {
  dogallik: number; // 20
  uygunluk: number; // 20
  aciklik: number; // 15
  deger: number; // 15
  guven: number; // 15
  cta: number; // 10
  marka: number; // 5
};

export type QualityResult = {
  score: number;
  breakdown: QualityBreakdown;
  /** Puan düşüren nedenler */
  reasons: string[];
  /** Operatörün bilmesi gereken uyarılar */
  warnings: string[];
  /** Gönderimi engelleyen sorunlar */
  blockers: string[];
  requiresHumanReview: boolean;
  words: number;
};

export const MAX: QualityBreakdown = { dogallik: 20, uygunluk: 20, aciklik: 15, deger: 15, guven: 15, cta: 10, marka: 5 };
export const TARGET_SCORE = 90;
export const REWRITE_BELOW = 85;

const lower = (s: string) => s.toLocaleLowerCase("tr");

// Yapılmamış işi yapılmış gibi gösteren ifadeler
const WORK_CLAIMS = /(?<![\p{L}\p{N}])(hazırladım|hazırladık|tasarladım|tasarladık|tasarımını tamamladı[mk]|tasarım(ı)? hazır|taslağ?ı? hazırladı[mk]|örnek (bir )?(site|tasarım|sayfa)\p{L}* hazırladı[mk])(?![\p{L}\p{N}])/iu;
const INSPECTION_CLAIMS = /(sitenizi (inceledim|inceledik|analiz ettim|analiz ettik)|sitenize (baktım|baktık|göz attım|göz attık)|sitesine (baktım|baktık|göz attım|göz attık)|sitesini (inceledim|inceledik)|\binceledim\b|\banaliz ettim\b|\banaliz ettik\b|eksiklik(ler)? (buldum|bulduk|tespit ettim|tespit ettik)|geliştirme alan(ı|ları) belirledi[mk]|sorun(lar)? tespit ettik)/iu;
const PRIOR_CONTACT_CLAIMS = /(yazmıştım|yazmıştık|göndermiştim|göndermiştik|paylaşmıştım|paylaşmıştık|bahsetmiştim|bahsetmiştik|konuşmuştuk|önceki mesajım)/iu;
const URGENCY = /(son fırsat|kaçırmayın|acele edin|hemen şimdi|sınırlı süre|bugüne özel|sadece bugün|son gün|stoklarla sınırlı|kontenjan sınırlı|garanti(li|liyoruz|ediyoruz)?\b|%\s?100|yüzde yüz)/iu;
const RUDE_FOLLOWUP = /(mesajımı gördünüz mü|neden dönüş|dönüş yapmadınız|cevap vermediniz|son kez yazıyorum|hala bekliyorum|hâlâ bekliyorum)/iu;
const CLICHES = /(dijital dünyada|bir üst seviyeye|harika bir fırsat|mükemmel çözüm|satışlarınızı artır|profesyonelleştirmek ister misiniz|günümüzde artık|hayalinizdeki|işinizi büyüt|rakiplerinizin önüne|sektörün lideri|öncü çözümler|size özel harika|fark yaratın|kaliteli hizmet anlayışı|en uygun fiyat)/iu;
const ROBOTIC = /(sayın yetkili|değerli işletme sahibi|firmanız için harika|bilgilerinize sunarız|saygılarımızla|iyi günler dileriz)/iu;
const SUPERLATIVE = /((?<!\p{L})en iyi(?!\p{L})|(?<!\p{L})lider(?!\p{L})|1 numara|bir numaralı|kesin sonuç|kesinlikle artar)/iu;
const ENGLISH = /\b(win-win|deal|solution|growth|lead(ler)?|conversion|landing page|cta|follow[- ]?up|boost|branding|awareness|engagement)\b/iu;
const JARGON = /\b(seo|responsive|framework|backend|frontend|api|ui\/ux|ux|cms|crm|saas|mvp|next\.js|react)\b/iu;
const SLANG = /(?<!\p{L})(kanka|abi|abla|hocam|canım|reis|kardeşim|selamlar ya)(?!\p{L})/iu;
const LOW_VALUE = /(ücretsiz|bedava|beğenmezseniz|hiçbir ücreti yok|ücret almıyoruz)/iu;
const PRICE = /(\d[\d.]*\s?(tl|₺)|lira\b)/iu;
const MEETING = /(toplantı|görüntülü görüşme|zoom|meet\b)/iu;
const BENEFIT = /(güncel|kolay|kolaylaştır|hızlı|tek yerde|tek bakışta|tek ekranda|tek listede|sade|bulur|bulabil|ulaş|talep|zaman|takip|hatırlat|görür|net)/iu;
const CTA = /(\?|isterseniz|ister misiniz|anlatayım|paylaşayım|göstereyim|gönderebilirim|paylaşabilirim|yazmanız yeterli|yazarsanız|haber verin|dönüş yaparsanız|konuşabiliriz|uygun mu|ilk izleniminizi)/iu;
const SERVICES: [string, RegExp][] = [
  ["web sitesi", /(web sitesi|web sayfası|\bsite\b|sitesi\b)/iu],
  ["otomasyon", /(otomasyon|otomatik)/iu],
  ["uygulama", /(mobil uygulama|web uygulaması)/iu],
  ["yapay zekâ", /(yapay zek|chatbot|\bai\b)/iu],
  ["e-ticaret", /(e-ticaret|online mağaza)/iu],
  ["bakım", /(bakım desteği|aylık bakım)/iu],
  ["reklam", /(reklam|google ads|sosyal medya yönetimi)/iu],
];
const EMOJI = /\p{Extended_Pictographic}/gu;
const STOP_WORDS = new Set(["ltd", "şti", "sti", "san", "tic", "ve", "a.ş.", "aş", "ltd.", "şti.", "the", "&"]);

/**
 * Müşteri bağlamı olmayan şablonlar için doğruluk kontrolü: tasarım linki, site incelemesi
 * ve önceki temas kanıtı yokmuş gibi değerlendirir. Kuyruğa giren toplu mesajlar ve AI şablonları bunu kullanır.
 */
export function truthIssues(text: string, opts: { allowPriorContact?: boolean } = {}): string[] {
  const out: string[] = [];
  if (WORK_CLAIMS.test(text)) out.push("Yapılmamış bir çalışma yapılmış gibi yazılmış (“hazırladım/tasarladım”)");
  if (INSPECTION_CLAIMS.test(text)) out.push("İnceleme veya analiz yapılmış gibi yazılmış");
  if (!opts.allowPriorContact && PRIOR_CONTACT_CLAIMS.test(text)) out.push("Daha önce yazılmış gibi görünüyor");
  if (URGENCY.test(text)) out.push("Sahte aciliyet, kıtlık ya da garanti ifadesi var");
  if (RUDE_FOLLOWUP.test(text)) out.push("Baskı kuran takip ifadesi var");
  return out;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** İşletme adının mesajda geçip geçmediği (tam ad ya da ayırt edici ilk kelimeler) */
export function mentionsName(message: string, name: string): boolean {
  const m = lower(message);
  const n = lower(name).trim();
  if (!n || n === "işletmeniz") return true;
  if (m.includes(n)) return true;
  const words = n.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  if (!words.length) return false;
  const head = words.slice(0, Math.min(2, words.length)).join(" ");
  return m.includes(head) || (words[0].length >= 4 && m.includes(words[0]));
}

function wordSet(text: string): Set<string> {
  return new Set(lower(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
}

export function similarity(a: string, b: string): number {
  const x = wordSet(a);
  const y = wordSet(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common += 1;
  return common / (x.size + y.size - common);
}

function repeatedTrigram(text: string): boolean {
  const w = lower(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const seen = new Set<string>();
  for (let i = 0; i + 2 < w.length; i += 1) {
    const t = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
}

export function evaluateMessage(message: string, ctx: CustomerContext, categoryId: CategoryId): QualityResult {
  const profile = profileFor(ctx.sector.id);
  // Aynı işi yapan firmaya otomasyon/bakım/huni yerine iş birliği ilk teması yazılır
  const category = categoryById(
    profile.partner && ["otomasyon", "bakim", "huni"].includes(categoryId) ? "ilk_temas" : categoryId,
  );
  const text = message.trim();
  const b: QualityBreakdown = { ...MAX };
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const minus = (key: keyof QualityBreakdown, points: number, reason: string) => {
    b[key] = Math.max(0, b[key] - points);
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const words = wordCount(text);

  if (!text) {
    return {
      score: 0,
      breakdown: { dogallik: 0, uygunluk: 0, aciklik: 0, deger: 0, guven: 0, cta: 0, marka: 0 },
      reasons: ["Mesaj boş"],
      warnings: [],
      blockers: ["Mesaj boş"],
      requiresHumanReview: true,
      words: 0,
    };
  }

  // --- Zorunlu doğruluk ve izin kontrolleri ---
  if (/\{[^}]*\}|\[[^\]]*(işletme|isim|ad|firma|link)[^\]]*\]/iu.test(text)) {
    blockers.push("Çözülmemiş değişken var (ör. {ad}); mesajı tamamlayın");
  }
  if (WORK_CLAIMS.test(text) && !ctx.designLink) {
    blockers.push("Yapılmamış bir çalışma yapılmış gibi yazılmış (“hazırladım/tasarladım”). Tasarım linki eklemediyseniz bu ifadeyi çıkarın");
  }
  if (ctx.designLink && WORK_CLAIMS.test(text) && !text.includes(ctx.designLink)) {
    warnings.push("Tasarımdan bahsediliyor ama link mesajda yok");
  }
  if (INSPECTION_CLAIMS.test(text) && !ctx.website.inspected) {
    blockers.push("İnceleme veya analiz yapılmış gibi yazılmış; sistem siteyi incelemedi");
  }
  if (PRIOR_CONTACT_CLAIMS.test(text) && !ctx.previousContacts.length) {
    blockers.push("Daha önce yazılmış gibi görünüyor ama kayıtlı bir temas yok");
  }
  if (URGENCY.test(text)) blockers.push("Sahte aciliyet, kıtlık ya da garanti ifadesi var");
  if (RUDE_FOLLOWUP.test(text)) blockers.push("Baskı kuran ya da suçlayan takip ifadesi var");
  if (ctx.optedOut && category.sales) {
    blockers.push("Bu müşteri iletişim istemediğini belirtmiş; satış mesajı gönderilmez");
  }
  if (category.needsReply && !ctx.customerReply) {
    warnings.push("Müşterinin mesajı girilmedi; yanıt bağlamsız kalabilir");
  }

  // --- Doğallık (20) ---
  const cliches = text.match(new RegExp(CLICHES.source, "giu"))?.length ?? 0;
  if (cliches) minus("dogallik", Math.min(15, cliches * 7), "Klişe satış ifadesi var");
  if (ROBOTIC.test(text)) minus("dogallik", 5, "Kalıp, resmi yazışma dili");
  if (ENGLISH.test(text)) minus("dogallik", 3, "Gereksiz İngilizce kelime");
  if ((text.match(/!/g)?.length ?? 0) > 1) minus("dogallik", 3, "Fazla ünlem");
  if ((text.match(EMOJI)?.length ?? 0) > 1) minus("dogallik", 3, "Fazla emoji");
  const withoutName = ctx.name.split(/\s+/).reduce((acc, w) => (w ? acc.split(w).join(" ") : acc), text);
  if (/(?<!\p{L})\p{Lu}{5,}(?!\p{L})/u.test(withoutName.replace(/WEXON|WHATSAPP|GOOGLE/g, ""))) minus("dogallik", 2, "Büyük harfle yazılmış kelime");
  if (repeatedTrigram(text)) minus("dogallik", 4, "Tekrarlanan ifade");
  if (SLANG.test(text)) minus("marka", 5, "Laubali hitap");
  const nameLower = lower(ctx.name);
  if (nameLower && new RegExp(`^merhaba\\s+${nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu").test(lower(text))) {
    minus("dogallik", 3, "İşletme adı selamlamaya yapıştırılmış (kişi adı gibi)");
  }

  // --- Müşteriye uygunluk (20) ---
  if (category.needsName && !mentionsName(text, ctx.name)) {
    minus("uygunluk", 8, "İşletme adı geçmiyor; mesaj kime yazıldığı belli olmayan bir kalıp gibi");
  }
  if (["ilk_temas", "otomasyon", "huni", "bakim"].includes(category.id) && ctx.sector.id !== "generic" && !ctx.designLink) {
    const m = lower(text);
    if (!profile.signals.some((s) => m.includes(lower(s)))) minus("uygunluk", 5, "Sektöre özgü bir fayda anılmıyor");
  }
  // Kişiselleştirme: yalnızca ad + sektör kalıbı tam puan almaz; işletmeye özgü doğrulanmış bir ayrıntı gerekir
  const cold = ["ilk_temas", "otomasyon", "huni", "bakim"].includes(category.id);
  if (cold) {
    const m = lower(text);
    const specific =
      (ctx.designLink && text.includes(ctx.designLink)) ||
      (ctx.reviewCount && m.includes(String(ctx.reviewCount))) ||
      (ctx.location && ctx.location.length > 3 && !/^merkez$/i.test(ctx.location) && m.includes(lower(ctx.location))) ||
      (ctx.website.host && (m.includes(lower(ctx.website.host)) || m.includes(lower(ctx.website.host.split(".")[0]))));
    if (!specific) minus("uygunluk", 4, "İşletmeye özgü bir ayrıntı yok; yalnızca ad ve sektör kullanılmış");
  }
  // Aynı metni isim değiştirerek başka müşterilere göndermek
  const strip = (t: string) => {
    let out = lower(t);
    for (const w of lower(ctx.name).split(/\s+/)) if (w.length > 2) out = out.split(w).join(" ");
    return out;
  };
  const clone = ctx.recentOthers.find((o) => similarity(strip(text), lower(o)) > 0.7);
  if (clone) {
    minus("uygunluk", 10, "Başka müşterilere giden mesajla neredeyse aynı");
    warnings.push("Bu metin son günlerde başka işletmelere gönderilen bir mesajla neredeyse aynı. İşletmeye özgü bir ayrıntı ekleyin ya da başka bir taslak seçin.");
  }
  if (profile.partner && cold && /(web sitesi fikr|site kurgula|sitenizi yenile|web siteniz için)/iu.test(text)) {
    minus("uygunluk", 8, "Aynı işi yapan firmaya web sitesi satılmaya çalışılıyor");
    warnings.push("Bu işletme yazılım ya da ajans görünüyor; web sitesi satmak yerine iş birliği önerin.");
  }
  if (category.id === "bakim" && ctx.website.kind !== "site") {
    minus("uygunluk", 8, "Kayıtlı web sitesi yok; bakım teklifi bu müşteriye uygun olmayabilir");
    warnings.push("Bu müşterinin kayıtlı bir web sitesi yok; bakım mesajı yerine ilk temas daha uygun");
  }
  if (category.id === "takip" && !ctx.previousContacts.length) {
    warnings.push("Önceki temas kaydı yok; takip yerine ilk temas mesajı daha uygun");
  }
  for (const prev of ctx.previousContacts) {
    if (similarity(text, prev.message) > 0.55) {
      minus("uygunluk", 10, "Önceki mesajı büyük ölçüde tekrar ediyor");
      break;
    }
  }

  // --- Açıklık ve kısalık (15) ---
  const [lo, hi] = category.words;
  if (words > hi) minus("aciklik", Math.min(10, Math.ceil((words - hi) / 3)), `Uzun (${words} kelime; hedef ${lo}-${hi})`);
  if (words < lo) minus("aciklik", Math.min(6, Math.ceil((lo - words) / 3)), `Çok kısa (${words} kelime; hedef ${lo}-${hi})`);
  const ss = sentences(text);
  if (ss.length > 5) minus("aciklik", 3, "Çok fazla cümle");
  if (ss.some((s) => wordCount(s) > 28)) minus("aciklik", 3, "Fazla uzun cümle");

  // --- Değer önerisi (15) ---
  if (category.sales && ["ilk_temas", "otomasyon", "huni", "bakim"].includes(category.id) && !BENEFIT.test(text)) {
    minus("deger", 7, "Müşteri açısından somut fayda anlatılmıyor");
  }
  const services = SERVICES.filter(([, re]) => re.test(text)).map(([n]) => n);
  if (services.length >= 3) minus("deger", 6, `Aynı mesajda birden fazla teklif (${services.join(", ")})`);
  if (JARGON.test(text)) minus("deger", 4, "Gereksiz teknik terim");

  // --- Güvenilirlik (15) ---
  if (blockers.length) minus("guven", 15, "Doğrulanmamış veya izinsiz içerik");
  if (LOW_VALUE.test(text)) minus("guven", 4, "“Ücretsiz/beğenmezseniz” dili teklifin değerini düşürüyor");
  if (SUPERLATIVE.test(text)) minus("guven", 5, "Kanıtlanmamış üstünlük iddiası");
  if (PRICE.test(text) && category.id !== "fiyat") {
    minus("guven", 3, "Fiyat bu mesaj türünde erken");
    warnings.push("Mesajda fiyat geçiyor; fiyatın güncel olduğundan emin olun");
  }
  if (PRICE.test(text) && category.id === "fiyat" && !ctx.startPrice) {
    warnings.push("Playbook’ta kayıtlı bir fiyat yok; mesajdaki rakamı kontrol edin");
  }
  if (profile.sensitive && /(tedavi garanti|iyileştir|şifa|hasta sayınızı|kesin çözüm|önce.?sonra)/iu.test(text)) {
    minus("guven", 6, "Sağlık alanında uygunsuz vaat");
    warnings.push("Sağlık alanında reklam ve gizlilik kurallarına dikkat edin");
  }

  // --- CTA (10) ---
  const questions = text.match(/\?/g)?.length ?? 0;
  if (questions > category.maxQuestions) {
    minus("cta", Math.min(8, (questions - category.maxQuestions) * 4), category.maxQuestions === 0 ? "Kapanış mesajında soru olmamalı" : "Çok fazla soru");
  }
  if (category.needsCta && !CTA.test(text)) minus("cta", 6, "Cevap vermeyi kolaylaştıran bir soru ya da adım yok");
  if (category.id === "ilk_temas" && MEETING.test(text)) minus("cta", 3, "İlk mesajda toplantı istemek erken");

  // --- Marka tonu (5) ---
  if (["ilk_temas", "otomasyon", "huni", "bakim"].includes(category.id) && !lower(text).includes(lower(ctx.brand).replace(/\.dev$/, ""))) {
    minus("marka", 3, "Kimin yazdığı belli değil");
  }

  let score = Object.values(b).reduce((s, n) => s + n, 0);
  if (blockers.length) score = Math.min(score, 40);
  return {
    score,
    breakdown: b,
    reasons,
    warnings,
    blockers,
    requiresHumanReview: blockers.length > 0 || warnings.length > 0 || score < REWRITE_BELOW,
    words,
  };
}
