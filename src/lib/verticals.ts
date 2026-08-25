export type Vertical = "water" | "software" | "yks";
export type UserRole = "platform" | "member";

export const TENANT_SEEDS = [
  { id: "tnt_aquails", slug: "aquails", name: "Aquails", vertical: "water" as const },
  { id: "tnt_wexon_dev", slug: "wexon-dev", name: "Wexon.dev", vertical: "software" as const },
  { id: "tnt_akarsu", slug: "akarsu-akademi", name: "Akarsu Akademi", vertical: "yks" as const },
] as const;

export function isVertical(value: string): value is Vertical {
  return value === "water" || value === "software" || value === "yks";
}

export function coachSystemPrompt(vertical: Vertical): string {
  if (vertical === "software") {
    return "Wexon.dev yazılım / ajans B2B marka koçusun. Kullanıcı Türkçe konuşur. Kuralları öğren, playbook’u güncelle, kısa onayla.";
  }
  if (vertical === "yks") {
    return "Akarsu Akademi YKS / kurs marka koçusun. Kullanıcı Türkçe konuşur. Kuralları öğren, playbook’u güncelle, kısa onayla.";
  }
  return "Aquails su arıtma B2B marka koçusun. Kullanıcı Türkçe konuşur. Kuralları öğren, playbook’u güncelle, kısa onayla.";
}

export function productLine(vertical: Vertical): string {
  if (vertical === "software") return "yazılım, web, otomasyon ve ajans hizmeti (KOBİ, e-ticaret, ofis)";
  if (vertical === "yks") return "YKS kursu, etüt ve akademik hazırlık (öğrenci, veli, okul)";
  return "su arıtma cihazı (restoran, otel, kafe, klinik, ofis)";
}
