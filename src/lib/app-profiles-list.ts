// Tarayıcıda da kullanılabilen profil listesi (kripto içermez). Ayrıntı: ./app-profiles.ts
export type AppProfile = { tenantId: string; ad: string; aciklama: string; harf: string; renk: string };

export const APP_PROFILES: AppProfile[] = [
  { tenantId: "tnt_wexon_dev", ad: "Wexon.dev", aciklama: "Web sitesi ve yazılım müşterileri", harf: "W", renk: "#0f4c45" },
  { tenantId: "tnt_aquails", ad: "Aquails", aciklama: "Su arıtma müşterileri · aquails.com", harf: "A", renk: "#0b6fb3" },
];

/** Ortak anahtar kaynağı: Google Places ve Gemini anahtarları bu profilden okunur (WhatsApp hariç) */
export const SHARED_KEYS_FROM: Record<string, string> = { tnt_aquails: "tnt_wexon_dev" };

/** Ortak kullanılan ayar alanları (WhatsApp alanları bilerek yok) */
export const SHARED_SETTING_FIELDS = ["googlePlacesApiKey", "llmApiKey", "llmBaseUrl", "llmModel", "llmProvider"] as const;

