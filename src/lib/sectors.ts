export type Sector = {
  label: string;
  query: string;
  en: string;
};

export type SectorGroup = {
  id: string;
  label: string;
  items: Sector[];
};

export const SECTOR_GROUPS: SectorGroup[] = [
  {
    id: "food",
    label: "Yiyecek & içecek",
    items: [
      { label: "Restoran", query: "restoran", en: "restaurant" },
      { label: "Lokanta", query: "lokanta", en: "local restaurant" },
      { label: "Kafe", query: "kafe", en: "cafe" },
      { label: "Kahve", query: "kahve dükkanı", en: "coffee shop" },
      { label: "Pastane", query: "pastane", en: "bakery" },
      { label: "Fırın", query: "fırın", en: "bakery" },
      { label: "Catering", query: "catering", en: "catering" },
      { label: "Fast food", query: "fast food", en: "fast food restaurant" },
      { label: "Otel mutfağı", query: "otel restoran", en: "hotel restaurant" },
      { label: "Yemekhane", query: "yemekhane", en: "cafeteria" },
    ],
  },
  {
    id: "stay",
    label: "Konaklama",
    items: [
      { label: "Otel", query: "otel", en: "hotel" },
      { label: "Apart otel", query: "apart otel", en: "aparthotel" },
      { label: "Pansiyon", query: "pansiyon", en: "guesthouse" },
      { label: "Resort", query: "tatil köyü", en: "resort" },
    ],
  },
  {
    id: "health",
    label: "Sağlık",
    items: [
      { label: "Klinik", query: "klinik", en: "clinic" },
      { label: "Hastane", query: "hastane", en: "hospital" },
      { label: "Diş", query: "diş kliniği", en: "dental clinic" },
      { label: "Tıp merkezi", query: "tıp merkezi", en: "medical center" },
      { label: "Eczane", query: "eczane", en: "pharmacy" },
      { label: "Laboratuvar", query: "tıp laboratuvarı", en: "medical lab" },
      { label: "Veteriner", query: "veteriner", en: "veterinary clinic" },
    ],
  },
  {
    id: "work",
    label: "Ofis & üretim",
    items: [
      { label: "Ofis", query: "ofis", en: "office" },
      { label: "Plaza", query: "plaza ofis", en: "office building" },
      { label: "Coworking", query: "coworking", en: "coworking space" },
      { label: "Fabrika", query: "fabrika", en: "factory" },
      { label: "Atölye", query: "imalathane", en: "workshop" },
      { label: "Depo", query: "depo", en: "warehouse" },
    ],
  },
  {
    id: "care",
    label: "Spor & bakım",
    items: [
      { label: "Spor", query: "spor salonu", en: "gym" },
      { label: "Spa", query: "spa", en: "spa" },
      { label: "Kuaför", query: "kuaför", en: "hair salon" },
      { label: "Güzellik", query: "güzellik salonu", en: "beauty salon" },
      { label: "Hamam", query: "hamam", en: "turkish bath" },
      { label: "Havuz", query: "yüzme havuzu", en: "swimming pool" },
      { label: "Oto yıkama", query: "oto yıkama", en: "car wash" },
    ],
  },
  {
    id: "edu",
    label: "Eğitim & yaşam",
    items: [
      { label: "Okul", query: "okul", en: "school" },
      { label: "Kreş", query: "kreş", en: "kindergarten" },
      { label: "Üniversite", query: "üniversite", en: "university" },
      { label: "Yurt", query: "öğrenci yurdu", en: "dormitory" },
      { label: "Huzurevi", query: "huzurevi", en: "nursing home" },
    ],
  },
  {
    id: "retail",
    label: "Perakende & etkinlik",
    items: [
      { label: "Market", query: "süpermarket", en: "supermarket" },
      { label: "AVM", query: "alışveriş merkezi", en: "shopping mall" },
      { label: "Düğün salonu", query: "düğün salonu", en: "wedding venue" },
      { label: "Rezidans", query: "site rezidans", en: "residential complex" },
    ],
  },
];

const FLAT = SECTOR_GROUPS.flatMap((g) => g.items);

export function englishQuery(query: string): string {
  const key = query.trim().toLowerCase();
  const hit = FLAT.find((s) => s.query === key || s.label.toLowerCase() === key);
  return hit?.en ?? query;
}

export function parseQueries(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}
