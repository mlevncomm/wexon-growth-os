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

type SectorId =
  | "kuafor"
  | "restoran"
  | "kafe"
  | "klinik"
  | "dis"
  | "emlak"
  | "muhasebe"
  | "avukat"
  | "otel"
  | "insaat"
  | "oto"
  | "magaza"
  | "lojistik"
  | "spor"
  | "ofis"
  | "egitim"
  | "generic";

const SECTORS: { id: SectorId; label: string; keys: string[] }[] = [
  { id: "dis", label: "diş kliniği", keys: ["diş", "dis klinik", "dental", "ortodont"] },
  { id: "kuafor", label: "kuaför", keys: ["kuaför", "kuafor", "coiffeur", "coiffure", "hair", "berber", "güzellik", "guzellik", "nail", "protez tırnak", "spa", "hamam"] },
  { id: "kafe", label: "kafe", keys: ["kafe", "cafe", "kahve", "coffee", "espresso"] },
  { id: "restoran", label: "restoran", keys: ["restoran", "lokanta", "restaurant", "kebap", "pide", "ocakbaşı", "brasserie", "mezz", "pastane", "fırın", "firin", "catering", "fast food", "yemekhane"] },
  { id: "klinik", label: "klinik", keys: ["klinik", "hastane", "tıp", "tip merkezi", "estetik", "veteriner", "eczane", "laboratuvar", "fizyo"] },
  { id: "emlak", label: "emlak", keys: ["emlak", "gayrimenkul", "real estate"] },
  { id: "muhasebe", label: "muhasebe", keys: ["muhasebe", "mali müşavir", "mali musavir", "smmm"] },
  { id: "avukat", label: "avukat", keys: ["avukat", "hukuk", "lawyer", "attorney"] },
  { id: "otel", label: "otel", keys: ["otel", "hotel", "pansiyon", "apart otel", "tatil köyü", "resort"] },
  { id: "insaat", label: "inşaat", keys: ["inşaat", "insaat", "müteahhit", "muteahhit", "yapı", "yapi"] },
  { id: "oto", label: "oto servis", keys: ["oto servis", "oto tamir", "otomotiv", "lastik", "mekanik", "oto yıkama", "oto yikama"] },
  { id: "magaza", label: "mağaza", keys: ["mağaza", "magaza", "butik", "store", "e-ticaret", "eticaret", "market", "süpermarket", "supermarket", "avm", "alışveriş"] },
  { id: "lojistik", label: "lojistik", keys: ["lojistik", "nakliyat", "kargo", "depo"] },
  { id: "spor", label: "spor salonu", keys: ["spor", "gym", "fitness", "pilates"] },
  { id: "egitim", label: "eğitim", keys: ["okul", "dershane", "kurs", "kreş", "kres", "etüt", "üniversite", "yurt"] },
  { id: "ofis", label: "ofis", keys: ["ofis", "danışman", "danisman", "sigorta", "mimar", "noter", "coworking", "plaza", "fabrika", "imalathane"] },
];

const SOFTWARE: Record<SectorId, Record<PitchOffer, string>> = {
  kuafor: {
    web: "Merhaba {ad}, {ilçe} salonunda randevu çoğu zaman WhatsApp ve Instagram’da kayboluyor. Online randevu + vitrin site ile dolu saati netleştiriyoruz. 10 dakikalık bir bakış uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} kuaförünüzün sitesi var ama randevu hâlâ telefona düşüyorsa dönüşüm kaçıyor. Form, WhatsApp ve Google görünürlüğünü aynı akışa bağlıyoruz. Kısa bir kontrol paylaşayım mı?",
  },
  restoran: {
    web: "Merhaba {ad}, {ilçe} restoranda menü ve rezervasyon Instagram bio’da kalınca masa kaçıyor. Rezervasyonlu site + Google Maps düzeni kuruyoruz. Bu hafta 10 dakika ayırabilir misiniz?",
    yenile: "Merhaba {ad}, {ilçe} işletmenizin sitesi var; menü ve rezervasyon güncel değilse arama kaybettiriyor. Hız, menü ve rezervasyonu tek sayfada toparlıyoruz. Uygun bir gün var mı?",
  },
  kafe: {
    web: "Merhaba {ad}, {ilçe} kahve dükkanında konum ve menü çoğu misafire Instagram’dan gidiyor. Vitrin site + harita + WhatsApp sipariş satırı kuruyoruz. Kısa bir örnek göstereyim mi?",
    yenile: "Merhaba {ad}, {ilçe} kafenizin sitesi var ama yavaş veya menüsüzse Google’da geride kalırsınız. Hız ve menü kartını düzeltip haritayı güçlendiriyoruz. 10 dakikalık bakış uygun mu?",
  },
  klinik: {
    web: "Merhaba {ad}, {ilçe} klinikte hasta çoğu zaman Instagram’dan geliyor, randevu yine telefona düşüyor. Hizmet sayfası + randevu formu olan sade bir site kuruyoruz. Uygun bir saatte bakabilir miyiz?",
    yenile: "Merhaba {ad}, {ilçe} kliniğinizin sitesi var; randevu ve tedavi sayfaları zayıfsa Google’da rakip öne çıkar. İçerik + form + hız düzeni yapıyoruz. Kısa bir tarama notu paylaşayım mı?",
  },
  dis: {
    web: "Merhaba {ad}, {ilçe} diş kliniğinde tedavi fiyatı ve randevu sorusu hâlâ mesaj kutusunda birikiyor. Tedavi sayfaları + randevu formu olan bir site kuruyoruz. 10 dakikalık görüşme uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} kliniğinizin sitesi var ama implant/ortodonti sayfası yoksa arama kaybettirir. Tedavi sayfası ve randevu formunu netleştiriyoruz. Kısa bir kontrol ister misiniz?",
  },
  emlak: {
    web: "Merhaba {ad}, {ilçe} portföyü WhatsApp’ta dağınık kalınca ilan kaçıyor. İlan listeli site + WhatsApp yönlendirme kuruyoruz. Bu hafta 15 dakikalık bir bakış uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} ofisinizin sitesi var; ilanlar güncel değilse güven düşer. Portföy ve teklif formunu aynı akışa bağlıyoruz. Kısa bir tur atalım mı?",
  },
  muhasebe: {
    web: "Merhaba {ad}, {ilçe} mali müşavirlikte yeni iş çoğu referansla geliyor, sitede hizmet görünmüyor. Hizmet + randevu sayfası olan sade bir ofis sitesi kuruyoruz. Uygun bir gün var mı?",
    yenile: "Merhaba {ad}, {ilçe} ofisinizin sitesi var ama beyanname/şirket kuruluşu sayfası yoksa arama sizi atlar. Hizmet sayfalarını netleştiriyoruz. 10 dakikalık bir bakış uygun mu?",
  },
  avukat: {
    web: "Merhaba {ad}, {ilçe} büroda dosya sorusu Instagram ve telefonda karışıyor. Uzmanlık sayfaları + görüşme formu olan sade bir site kuruyoruz. Kısa bir tanışma uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} büronuzun sitesi var; uzmanlıklar tek paragrafta kalıyorsa müvekkil Google’da başkasını seçer. Sayfa yapısını netleştiriyoruz. Uygun bir gün var mı?",
  },
  otel: {
    web: "Merhaba {ad}, {ilçe} tesiste oda sorusu Booking dışında Instagram’a düşüyor. Direkt rezervasyonlu vitrin site kuruyoruz, komisyonu azaltır. 15 dakikalık bir bakış uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} otelinizin sitesi var; direkt rezervasyon zayıfsa komisyon yer. Hız, oda sayfası ve rezervasyonu toparlıyoruz. Kısa bir kontrol paylaşayım mı?",
  },
  insaat: {
    web: "Merhaba {ad}, {ilçe} şantiyede referans proje WhatsApp’ta kayboluyor. Proje galerili kurumsal site + teklif formu kuruyoruz. Bu hafta uygun bir gün var mı?",
    yenile: "Merhaba {ad}, {ilçe} firmanızın sitesi var; biten işler güncel değilse ihale güveni düşer. Proje ve teklif akışını yeniliyoruz. 10 dakikalık bakış uygun mu?",
  },
  oto: {
    web: "Merhaba {ad}, {ilçe} serviste randevu ve fiyat sorusu telefonda kuyruk oluyor. Hizmet listeli site + WhatsApp randevu satırı kuruyoruz. Kısa bir örnek göstereyim mi?",
    yenile: "Merhaba {ad}, {ilçe} servisinizin sitesi var ama randevu yoksa müşteri başka dükkâna gider. Form ve harita görünürlüğünü düzeltiyoruz. Uygun bir gün var mı?",
  },
  magaza: {
    web: "Merhaba {ad}, {ilçe} mağazada vitrin Instagram, satış dükkânda kalıyor. Ürün/vitrin site veya vitrin + WhatsApp sipariş kuruyoruz. 10 dakikalık ihtiyaç turu uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} mağazanızın sitesi var; ürün ve sepet yavaşsa satış kaçıyor. Hız ve ürün sayfasını toparlıyoruz. Kısa bir teknik not paylaşayım mı?",
  },
  lojistik: {
    web: "Merhaba {ad}, {ilçe} lojistikte teklif hâlâ telefonda yazılıyor. Hizmet + teklif formlu sade bir site kuruyoruz. Bu hafta 10 dakika ayırabilir misiniz?",
    yenile: "Merhaba {ad}, {ilçe} firmanızın sitesi var; teklif formu yoksa iş WhatsApp’ta kaybolur. Form ve hat sayfalarını netleştiriyoruz. Uygun bir gün var mı?",
  },
  spor: {
    web: "Merhaba {ad}, {ilçe} salonda üyelik sorusu Instagram DM’de birikiyor. Paketler + kayıt formu olan site kuruyoruz. Kısa bir bakış uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} salonunuzun sitesi var; paket ve kayıt sayfası zayıfsa üye kaçıyor. Form ve paketleri netleştiriyoruz. 10 dakikalık kontrol ister misiniz?",
  },
  ofis: {
    web: "Merhaba {ad}, {ilçe} ofiste hizmet tarifi sitede yoksa teklif referansa kalıyor. Hizmet + randevu sayfası kuruyoruz. Uygun bir gün var mı?",
    yenile: "Merhaba {ad}, {ilçe} ofisinizin sitesi var; hizmetler tek blokta kalıyorsa arama sizi atlar. Sayfa yapısını netleştiriyoruz. Kısa bir tur atalım mı?",
  },
  egitim: {
    web: "Merhaba {ad}, {ilçe} kurumunda kayıt ve program Instagram’da dağınık. Program + kayıt formu olan site kuruyoruz. 10 dakikalık tanışma uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} kurumunuzun sitesi var; kayıt formu yoksa veli WhatsApp’a düşer. Program sayfası ve formu toparlıyoruz. Uygun bir gün var mı?",
  },
  generic: {
    web: "Merhaba {ad}, {ilçe} işletmesinde Google’da telefon var, site yoksa müşteri rakibe kayıyor. Sade vitrin + WhatsApp/form satırı kuruyoruz. 10 dakikalık bir bakış uygun mu?",
    yenile: "Merhaba {ad}, {ilçe} işletmenizin sitesi var; yavaş veya formsuzsa teklif kaçıyor. Hız, form ve Google görünürlüğünü toparlıyoruz. Kısa bir kontrol paylaşayım mı?",
  },
};

const WATER: Record<SectorId, string> = {
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

const YKS: Record<SectorId, string> = {
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

function haystack(lead: PitchLead): string {
  return [lead.name, lead.address, lead.notes, lead.campaignQuery, lead.district, lead.city]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr");
}

function hasKey(text: string, key: string): boolean {
  const k = key.toLocaleLowerCase("tr");
  if (k.length > 4 || k.includes(" ")) return text.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}0-9])${escaped}(?:$|[^\\p{L}0-9])`, "iu").test(text);
}

export function inferSector(lead: PitchLead): { id: SectorId; label: string } {
  const text = haystack(lead);
  for (const row of SECTORS) {
    if (row.keys.some((k) => hasKey(text, k))) return { id: row.id, label: row.label };
  }
  return { id: "generic", label: "işletme" };
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
  let raw = SOFTWARE.generic[offer];
  if (vertical === "software") raw = SOFTWARE[sector.id][offer];
  else if (vertical === "yks") raw = YKS[sector.id] ?? YKS.generic;
  else raw = WATER[sector.id] ?? WATER.generic;
  const body = renderTemplate(raw, lead);
  return {
    name: `${sector.label} — ${offerLabel(vertical, offer)}`,
    body,
    sector: sector.label,
    offer: offerLabel(vertical, offer),
  };
}

export const AUTO_TEMPLATE_ID = "auto";
export const AUTO_TEMPLATE_MARKER = "__AUTO__";
