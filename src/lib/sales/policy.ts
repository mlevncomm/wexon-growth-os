import type { ChannelState, LegalState } from "./consent";
import { isOptedOut } from "./context";

// Kime, ne zaman, hangi yoldan yazılabilir? Tek karar noktası. İki ayrı kontrol yapılır:
//
// 1) HUKUKİ DAYANAK (izin defteri, ./consent.ts):
//    - Ret bildiren ya da dayanağı geri çekilen müşteriye satış mesajı hiçbir yoldan gitmez;
//      yalnızca elle, bir kez kapanış mesajı yazılabilir.
//    - Otomatik/toplu gönderim (kuyruk) yalnızca kaynağıyla kaydedilmiş AÇIK ONAY varsa yapılır (Meta opt-in kuralı).
//    - Elle satış mesajı için kaydedilmiş bir dayanak gerekir: açık onay ya da operatörün tacir/esnaf beyanı.
//    - "Yazıldı" durumu ve kaynağı belirsiz eski "Onaylı" işareti dayanak sayılmaz.
// 2) TEKNİK UYGUNLUK (zamanlama ve sınırlar):
//    - Daha önce yazılmış ama dönmemiş müşteriye takip: son temastan en az 3 gün sonra, en fazla 2 kez.
//    - Müşteri döndüyse (Dönüş var / Geri aranacak) konuşma sürdürülür; bekleme süresi yoktur.

export const MIN_FOLLOWUP_DAYS = 3;
export const MAX_FOLLOWUPS = 2;

export type ContactHistory = {
  /** Bu müşteriye gönderilmiş ya da WhatsApp'ta açılmış mesaj sayısı */
  count: number;
  lastAt: Date | null;
  /** Daha önce kapanış mesajı gitti mi */
  closed?: boolean;
};

export type SendMode = "manual" | "queue";
export type ContactKind = "ilk" | "takip" | "yanit" | "kapanis";

export type PolicyResult = {
  allowed: boolean;
  kind: ContactKind;
  reason: string;
  warnings: string[];
  /** Engelin sebebi hukuki dayanak eksikliği mi (arayüz dayanak kaydı formunu gösterir) */
  needsBasis?: boolean;
  /** Hukuki dayanak tacir/esnaf beyanıysa mesajda ret hakkı belirtilmeli */
  retHakkiGerekli?: boolean;
  /** Engelin sebebi WhatsApp kanal izninin (Meta opt-in) olmaması mı */
  needsWhatsApp?: boolean;
};

export const NO_WHATSAPP =
  "Bu müşteri için kaydedilmiş WhatsApp izni (opt-in) yok. Ticari ileti dayanağı ya da ret cümlesi WhatsApp’tan yazmak için yeterli değildir; önce müşterinin WhatsApp’tan iletişimi kabul ettiğini kaynağıyla kaydedin."

export const NO_BASIS =
  "Bu müşteri için kayıtlı bir iletişim dayanağı yok. Önce dayanağı (açık onay ya da tacir/esnaf beyanı) kaynağıyla birlikte kaydedin; “Yazıldı” durumu izin sayılmaz.";
export const NO_CONSENT_QUEUE =
  "Kaynağıyla kaydedilmiş açık onay yok. Otomatik/toplu gönderim yalnızca açık onay veren müşterilere yapılır.";

export function contactPolicy(input: {
  status: string;
  notes?: string | null;
  legal: LegalState;
  /** WhatsApp kanal izni (her WhatsApp gönderimi için ayrıca gerekli) */
  whatsapp: ChannelState;
  history: ContactHistory;
  mode: SendMode;
  /** Gönderilecek mesajın türü (elle açmada bilinir) */
  category?: string;
  now?: Date;
}): PolicyResult {
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  const replied = input.status === "donus_var" || input.status === "geri_ara";
  const deny = (kind: ContactKind, reason: string, extra: Partial<PolicyResult> = {}): PolicyResult => ({ allowed: false, kind, reason, warnings, ...extra });
  const closing = (): PolicyResult =>
    input.history.closed
      ? deny("kapanis", "Bu müşteriye kapanış mesajı zaten gönderildi; tekrar yazılmaz.")
      : { allowed: true, kind: "kapanis", reason: "", warnings };

  // --- 1) Hukuki dayanak ---
  const optedOut = isOptedOut(input.status, input.notes) || input.legal.durum === "geri_cekildi";
  const waOk = input.whatsapp.durum === "var";
  if (optedOut) {
    if (input.mode === "manual" && input.category === "kapanis") {
      // Ret sonrası tek kapanış yanıtı yalnızca daha önce WhatsApp izni kaydedilmiş bir konuşmada yazılabilir
      if (!input.whatsapp.dahaOnceVardi) return deny("kapanis", "WhatsApp izni hiç kaydedilmediği için kapanış mesajı da WhatsApp’tan gönderilmez.", { needsWhatsApp: true });
      return closing();
    }
    return deny("kapanis", "Müşteri iletişim istemediğini bildirdi ya da izni geri çekildi; bu müşteriye mesaj gönderilmez.");
  }
  if (input.category === "kapanis") {
    if (input.mode !== "manual") return deny("kapanis", "Kapanış mesajı yalnızca elle gönderilir.");
    return waOk ? closing() : deny("kapanis", NO_WHATSAPP, { needsWhatsApp: true });
  }

  // --- 0) Kanal izni: WhatsApp'tan herhangi bir mesaj için Meta opt-in kaydı zorunlu ---
  if (!waOk) {
    const missingBasis = input.legal.durum !== "var";
    return deny(input.history.count || input.status === "yazildi" ? "takip" : replied ? "yanit" : "ilk", NO_WHATSAPP, { needsWhatsApp: true, needsBasis: missingBasis });
  }

  const legalOk = input.legal.durum === "var";
  const explicitConsent = legalOk && input.legal.tur === "acik_onay";
  if (input.legal.durum === "kaynaksiz") {
    warnings.push("Bu müşteride eski sürümden kalma, kaynağı kayıtlı olmayan bir “Onaylı” işareti var; dayanak sayılmaz.");
  }
  if (input.mode === "queue" && !explicitConsent) {
    return deny(input.history.count ? "takip" : "ilk", NO_CONSENT_QUEUE, { needsBasis: true });
  }
  // Müşterinin kendi yazdığı mesaja yanıt: konuşmayı sürdürmek için dayanak şartı aranmaz
  if (replied) {
    if (!legalOk) warnings.push("Müşteri size yazdı; yanıt verebilirsiniz. Satış teklifine geçmeden önce iletişim dayanağını kaydedin.");
    return { allowed: true, kind: "yanit", reason: "", warnings };
  }
  if (!legalOk) {
    return deny(input.history.count || input.status === "yazildi" ? "takip" : "ilk", NO_BASIS, { needsBasis: true });
  }
  const retHakkiGerekli = input.legal.tur === "tacir_esnaf";

  // --- 2) Teknik uygunluk ---
  // "Yazıldı" işaretli ama sistemde kaydı olmayan müşteri: ilk temas tekrar gönderilmez, takip sayılır
  const history =
    input.status === "yazildi" && !input.history.count ? { ...input.history, count: 1 } : input.history;
  if (input.status === "yazildi" && !input.history.count) {
    warnings.push("Bu müşteri “Yazıldı” işaretli ama sistemde mesaj kaydı yok; son temas tarihi bilinmiyor.");
  }
  if (!history.count) return { allowed: true, kind: "ilk", reason: "", warnings, retHakkiGerekli };

  const followups = history.count - 1;
  if (followups >= MAX_FOLLOWUPS) {
    return deny("takip", `Bu müşteriye ${history.count} kez yazıldı ve dönüş olmadı; en fazla ${MAX_FOLLOWUPS} takip yapılır.`);
  }
  const days = history.lastAt ? (now.getTime() - history.lastAt.getTime()) / 86_400_000 : Infinity;
  if (days < MIN_FOLLOWUP_DAYS) {
    const left = Math.ceil(MIN_FOLLOWUP_DAYS - days);
    return deny("takip", `Son mesajdan bu yana ${MIN_FOLLOWUP_DAYS} gün geçmedi; takip için ${left} gün daha bekleyin. Müşteri döndüyse durumunu “Dönüş var” yapın.`);
  }
  return { allowed: true, kind: "takip", reason: "", warnings, retHakkiGerekli };
}

/** Elle açılan mesaj türü, politikanın izin verdiği temas türüyle uyumlu mu */
export function categoryFits(kind: ContactKind, category: string): boolean {
  if (kind === "kapanis") return category === "kapanis";
  if (kind === "takip") return category === "takip" || category === "kapanis";
  return true;
}

/** Tacir/esnaf beyanıyla yazılan mesajda ret hakkı geçiyor mu */
export function mentionsOptOut(message: string): boolean {
  return /(istemezseniz|uygun değilse|ilgilenmiyorsanız|rahatsız etmeyeyim|tekrar yazmam|yazmayayım|“hayır” yazmanız|bir daha yazmam)/iu.test(message);
}
