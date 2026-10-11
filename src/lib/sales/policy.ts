import { isOptedOut } from "./context";

// Kime, ne zaman, hangi yoldan yazılabilir? Tek karar noktası.
// Üretim, elle açma kaydı, kuyruğa alma, onay ve gönderim anında aynı kurallar uygulanır.
//
// - Ret bildiren müşteriye (İlgilenmiyor durumu ya da notta açık ret) satış mesajı hiçbir yoldan gitmez;
//   yalnızca elle, bir kez kapanış mesajı yazılabilir.
// - Otomatik/toplu gönderim (kuyruk) yalnızca iletişim onayı kaydı olan müşteriye yapılır (Meta opt-in kuralı).
// - Daha önce yazılmış ama dönmemiş müşteriye takip yapılabilir: son temastan en az 3 gün sonra, en fazla 2 kez.
// - Müşteri döndüyse (Dönüş var / Geri aranacak) konuşma sürdürülür; bekleme süresi yoktur.

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
};

export function contactPolicy(input: {
  status: string;
  notes?: string | null;
  consented: boolean;
  history: ContactHistory;
  mode: SendMode;
  /** Gönderilecek mesajın türü (elle açmada bilinir) */
  category?: string;
  now?: Date;
}): PolicyResult {
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  const replied = input.status === "donus_var" || input.status === "geri_ara";
  const deny = (kind: ContactKind, reason: string): PolicyResult => ({ allowed: false, kind, reason, warnings });

  if (isOptedOut(input.status, input.notes)) {
    if (input.mode === "manual" && input.category === "kapanis") {
      if (input.history.closed) return deny("kapanis", "Bu müşteriye kapanış mesajı zaten gönderildi; tekrar yazılmaz.");
      return { allowed: true, kind: "kapanis", reason: "", warnings };
    }
    return deny("kapanis", "Müşteri iletişim istemediğini bildirdi; bu müşteriye mesaj gönderilmez.");
  }
  if (input.category === "kapanis") return { allowed: true, kind: "kapanis", reason: "", warnings };

  if (input.mode === "queue" && !input.consented) {
    return deny(
      input.history.count ? "takip" : "ilk",
      "İletişim onayı kaydı yok. Otomatik/toplu gönderim yalnızca onay veren müşterilere yapılır; bu müşteriye Müşteriler ekranından elle yazabilirsiniz.",
    );
  }

  if (replied) return { allowed: true, kind: "yanit", reason: "", warnings };

  if (!input.history.count) {
    if (!input.consented) warnings.push("İletişim onayı kaydı yok: ilk mesaj kısa ve baskısız olsun; ret gelirse bir daha yazılmaz.");
    return { allowed: true, kind: "ilk", reason: "", warnings };
  }

  const followups = input.history.count - 1;
  if (followups >= MAX_FOLLOWUPS) {
    return deny("takip", `Bu müşteriye ${input.history.count} kez yazıldı ve dönüş olmadı; en fazla ${MAX_FOLLOWUPS} takip yapılır.`);
  }
  const days = input.history.lastAt ? (now.getTime() - input.history.lastAt.getTime()) / 86_400_000 : Infinity;
  if (days < MIN_FOLLOWUP_DAYS) {
    const left = Math.ceil(MIN_FOLLOWUP_DAYS - days);
    return deny("takip", `Son mesajdan bu yana ${MIN_FOLLOWUP_DAYS} gün geçmedi; takip için ${left} gün daha bekleyin. Müşteri döndüyse durumunu “Dönüş var” yapın.`);
  }
  return { allowed: true, kind: "takip", reason: "", warnings };
}

/** Elle açılan mesaj türü, politikanın izin verdiği temas türüyle uyumlu mu */
export function categoryFits(kind: ContactKind, category: string): boolean {
  if (kind === "kapanis") return category === "kapanis";
  if (kind === "takip") return category === "takip" || category === "kapanis";
  return true;
}
