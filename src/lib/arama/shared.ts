// Sunucu ve tarayıcı tarafında ortak arama sabitleri.

export const OUTCOMES = [
  { value: "ilgilendi", label: "İlgilendi", status: "donus_var" },
  { value: "geri_ara", label: "Geri aranacak", status: "geri_ara" },
  { value: "ulasilamadi", label: "Açmadı", status: "ulasilamadi" },
  { value: "ilgilenmedi", label: "İlgilenmedi", status: "ilgilenmiyor" },
  { value: "sitesi_var", label: "Sitesi var", status: "ilgilenmiyor" },
  { value: "yanlis_numara", label: "Yanlış numara", status: "ilgilenmiyor" },
  { value: "aranmasin", label: "Bir daha arama", status: "ilgilenmiyor" },
] as const;
export type Outcome = (typeof OUTCOMES)[number]["value"];
export const isOutcome = (v: unknown): v is Outcome => OUTCOMES.some((o) => o.value === v);
export const outcomeOf = (v: Outcome) => OUTCOMES.find((o) => o.value === v)!;

export const VOICES = [
  { value: "marin", label: "Marin — sıcak kadın sesi" },
  { value: "coral", label: "Coral — enerjik kadın sesi" },
  { value: "shimmer", label: "Shimmer — yumuşak kadın sesi" },
  { value: "sage", label: "Sage — sakin kadın sesi" },
  { value: "ballad", label: "Ballad" },
  { value: "alloy", label: "Alloy" },
  { value: "cedar", label: "Cedar — erkek sesi" },
  { value: "ash", label: "Ash — erkek sesi" },
  { value: "echo", label: "Echo — erkek sesi" },
  { value: "verse", label: "Verse — erkek sesi" },
] as const;

/** Lead notlarına eklenen arama satırlarının işareti; deneme sayısı buradan sayılır. */
export const CALL_MARK = "📞";
