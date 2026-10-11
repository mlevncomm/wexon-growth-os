import { buildContext } from "./sales/context";
import { localDrafts } from "./sales/drafts";
import { inferSector as inferSalesSector, type SectorId } from "./sales/sector";
import { renderTemplate } from "./templates";
import type { Vertical } from "./verticals";
import { siteKind } from "./website";

export type PitchOffer = "web" | "yenile";

export type PitchLead = {
  name: string;
  district: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  notes?: string;
  campaignQuery?: string;
};

const WATER: Partial<Record<SectorId, string>> & { generic: string } = {
  restoran:
    "Merhaba {ad}, {ilçe} mutfağında kireç çayı, buzu ve makineyi bozar. Restoranlara uygun arıtma ile lezzeti koruyup arızayı düşürüyoruz. 10 dakikalık yerinde bakış uygun mu?",
  kafe:
    "Merhaba {ad}, {ilçe} kahvede suyun tadı fincanı satar. Kireç ve koku şikayetini kapalı devre arıtmayla kesiyoruz. Kısa bir tadım/ölçüm ayarlayalım mı?",
  otel:
    "Merhaba {ad}, {ilçe} tesiste çay, buz ve çamaşır hatları kireçten yorulur. Otel ölçeğinde arıtma ile servis sıklığını azaltıyoruz. Bu hafta 15 dakikalık ölçüm uygun mu?",
  klinik:
    "Merhaba {ad}, {ilçe} klinikte personel ve hasta suyu görünür bir konu. Kapalı devre arıtma tortu ve kireç şikayetini keser. Uygun bir saatte bakabilir miyiz?",
  dis: "Merhaba {ad}, {ilçe} klinikte ünit suyu kireçlenirse cihaz yorulur. Diş kliniklerine uygun arıtma ile bakımı sadeleştiriyoruz. 10 dakikalık keşif uygun mu?",
  kuafor:
    "Merhaba {ad}, {ilçe} salonda kireç saç ve cihazı yorar. Kuaföre uygun arıtma ile suyu yumuşatıyoruz. Kısa bir yerinde bakış ister misiniz?",
  magaza:
    "Merhaba {ad}, {ilçe} işletmede damacana maliyeti hızla biner. Tek kurulumla litre maliyetini netleştiriyoruz. Kısa bir karşılaştırma paylaşayım mı?",
  ofis:
    "Merhaba {ad}, {ilçe} ofiste personel suyu damacana ve kargo ile şişiyor. Kapalı devre arıtma ile maliyeti sadeleştiriyoruz. Uygun bir gün var mı?",
  emlak: "Merhaba {ad}, {ilçe} ofiste misafir suyu küçük ama görünür bir detay. Sade arıtma kurulumu öneriyoruz. 10 dakikalık bakış uygun mu?",
  muhasebe: "Merhaba {ad}, {ilçe} ofiste damacana kuyruğu ve kargo zaman yer. Tek sistemle suyu çözüyoruz. Kısa bir maliyet özeti ister misiniz?",
  avukat: "Merhaba {ad}, {ilçe} büroda misafir ikramı kireçli suyla düşer. Sade arıtma ile tadı toparlıyoruz. Uygun bir gün var mı?",
  insaat: "Merhaba {ad}, {ilçe} şantiye/ofiste içme suyu lojistiği yorar. Sabit arıtma ile damacanayı kesiyoruz. 10 dakikalık bakış uygun mu?",
  oto: "Merhaba {ad}, {ilçe} serviste personel suyu ve çay kireçlenir. Küçük ölçekli arıtma ile dert bitiyor. Kısa bir keşif uygun mu?",
  lojistik: "Merhaba {ad}, {ilçe} depoda damacana stoğu yer kaplar. Sabit sistemle suyu sadeleştiriyoruz. Uygun bir gün var mı?",
  spor: "Merhaba {ad}, {ilçe} salonda içme suyu ve duş kireci şikayet yaratır. Tesise uygun arıtma öneriyoruz. 10 dakikalık bakış uygun mu?",
  egitim: "Merhaba {ad}, {ilçe} kurumunda öğrenci/personel suyu hijyen konusu. Kapalı devre arıtma ile netleştiriyoruz. Kısa bir keşif uygun mu?",
  generic:
    "Merhaba {ad}, {ilçe} işletmesinde kireç tadı ve damacana maliyeti birikir. Kurulum ve filtre planını tek sayfada özetliyoruz. Size uyan bir gün var mı?",
};

const YKS: Partial<Record<SectorId, string>> & { generic: string } = {
  egitim:
    "Merhaba {ad}, {ilçe} kurumunda asıl fark deneme analizi ve eksik konu kapanışıdır. Akarsu’da birebir takip + deneme raporu var. 10 dakikalık tanıtım uygun mu?",
  ofis:
    "Merhaba {ad}, {ilçe} için YKS programı, deneme takvimi ve veli özetini aynı ritimde veriyoruz. Kontenjanı kısaca paylaşabilir miyim?",
  generic:
    "Merhaba {ad}, {ilçe} öğrencilerinde koçluk ve deneme raporu fark yaratır. Akarsu Akademi programını 10 dakikada özetleyeyim mi?",
  kuafor: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  restoran: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  kafe: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  klinik: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  dis: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  emlak: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  muhasebe: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  avukat: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  otel: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  insaat: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  oto: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  magaza: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  lojistik: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
  spor: "Merhaba {ad}, {ilçe} için YKS hazırlık programımızı kısaca anlatmak isteriz. Uygun bir gün var mı?",
};

export function inferSector(lead: PitchLead): { id: SectorId; label: string } {
  return inferSalesSector(lead);
}

// Yazılım dikeyinde kuyruğun otomatik taslağı, satış mesajı katmanının yerel taslağıdır:
// yalnızca kayıtlı bilgiyi kullanır, yapılmamış iş veya inceleme iddiası içermez.
function softwarePitch(lead: PitchLead): string {
  const ctx = buildContext({
    lead: { id: "auto", name: lead.name, address: lead.address, district: lead.district, city: lead.city, website: lead.website, notes: lead.notes },
    campaignQuery: lead.campaignQuery,
  });
  return localDrafts(ctx, ctx.website.kind === "site" ? "huni" : "ilk_temas")[0].message;
}

export function inferOffer(website: string): PitchOffer {
  return siteKind(website) === "site" ? "yenile" : "web";
}

function offerLabel(vertical: Vertical, offer: PitchOffer): string {
  if (vertical !== "software") return "teklif";
  return offer === "web" ? "yeni site" : "site yenileme";
}

export function composePitch(
  vertical: Vertical,
  lead: PitchLead,
): { name: string; body: string; sector: string; offer: string } {
  const sector = inferSector(lead);
  const offer = vertical === "software" ? inferOffer(lead.website) : "web";
  let raw: string;
  if (vertical === "software") raw = softwarePitch(lead);
  else if (vertical === "yks") raw = YKS[sector.id] ?? YKS.generic;
  else raw = WATER[sector.id] ?? WATER.generic;
  const body = vertical === "software" ? raw : renderTemplate(raw, lead);
  return {
    name: `${sector.label} — ${offerLabel(vertical, offer)}`,
    body,
    sector: sector.label,
    offer: offerLabel(vertical, offer),
  };
}

export const AUTO_TEMPLATE_ID = "auto";
export const AUTO_TEMPLATE_MARKER = "__AUTO__";
