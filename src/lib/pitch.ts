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
    web: "Merhaba {ad}, ben Wexon.dev’den yazıyorum. {ilçe} bölgesinde salonlar için randevuyu WhatsApp yazışmasından kurtarıp tek bir bağlantıya taşıyan basit siteler kuruyoruz. İsterseniz nasıl göründüğünü kısaca gösterebilirim, uygun musunuz?",
    yenile: "Merhaba {ad}, salonunuzun sitesini gördüm — randevu kısmı biraz eskimiş, ziyaretçi telefona düşmeden önce kaybolabiliyor. {ilçe}’deki benzer salonlarda bunu tek sayfada topluyoruz. Kısa bir bakış atmamı ister misiniz?",
  },
  restoran: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de menü ve rezervasyon Instagram profilinde kaybolan restoranlara sade, hızlı yüklenen bir site kuruyoruz — Google Haritalar’dan doğrudan masa alınabiliyor. İlgilenirseniz kısaca anlatabilirim.",
    yenile: "Merhaba {ad}, işletmenizin sitesini inceledim; menü güncel değilse ya da yavaş açılıyorsa arama sonuçlarında geride kalıyorsunuz demektir. {ilçe}’de bunu birkaç günde toparlıyoruz. Kısa bir görüşme uygun mu?",
  },
  kafe: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’deki bir kafenin konumu ve menüsü genelde Instagram’a gömülü kalıyor — misafir haritada aramıyor, DM’den soruyor. Basit bir vitrin site bu işi kolaylaştırıyor, kısa bir örnek gösterebilirim.",
    yenile: "Merhaba {ad}, kafenizin sitesine baktım; hız ve menü tarafı biraz geride kalmış görünüyor. {ilçe}’de bu tür siteleri birkaç günde tazeliyoruz. 10 dakikalık bir görüşme ayarlayabilir miyiz?",
  },
  klinik: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de hastalar çoğu zaman Instagram’dan geliyor ama randevu yine telefonla alınıyor — sade bir hizmet + randevu sayfası bu adımı kısaltıyor. Uygun bir saatte kısaca anlatabilir miyim?",
    yenile: "Merhaba {ad}, kliniğinizin sitesine baktım; tedavi sayfaları ve randevu formu biraz zayıf kalmış, arama sonucunda rakipler öne çıkabiliyor. {ilçe}’de bu tarz siteleri düzenli güncelliyoruz. Kısa bir not paylaşabilir miyim?",
  },
  dis: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de diş kliniklerinde fiyat ve randevu soruları genelde mesaj kutusunda birikiyor. Tedavi sayfaları ve randevu formu olan bir site bu yükü hafifletiyor. 10 dakikalık bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, kliniğinizin sitesini gördüm; implant ya da ortodonti gibi sayfalar eksikse arama sizi atlıyor olabilir. {ilçe}’de bunu tamamlıyoruz. Kısa bir kontrol paylaşmamı ister misiniz?",
  },
  emlak: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de portföyler genelde WhatsApp’ta dağınık kalıyor, ilanlar kayboluyor. Düzenli bir ilan sitesi bu işi toparlıyor. Bu hafta 15 dakikalık bir görüşme mümkün mü?",
    yenile: "Merhaba {ad}, ofisinizin sitesine baktım; ilanlar güncel değilse müşteri güveni düşüyor olabilir. {ilçe}’de portföy akışını tazeliyoruz. Kısa bir tur atalım mı?",
  },
  muhasebe: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de mali müşavirlik bürolarına genelde referansla iş geliyor, ama sitede hizmetler görünmüyor. Sade bir hizmet sayfası bunu değiştirebilir. Uygun bir gün var mı?",
    yenile: "Merhaba {ad}, ofisinizin sitesini gördüm; beyanname veya şirket kuruluşu gibi hizmetler ayrı sayfada değilse arama sizi atlıyor olabilir. {ilçe}’de bunu netleştiriyoruz. Kısa bir görüşme uygun mu?",
  },
  avukat: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de büroların dosya soruları çoğu zaman telefonla karışıyor. Uzmanlık alanlarını ayrı sayfada, görüşme formuyla toplayan bir site bunu sadeleştiriyor. Kısa bir tanışma uygun mu?",
    yenile: "Merhaba {ad}, büronuzun sitesine baktım; uzmanlık alanları tek paragrafta kalmış — müvekkil arama sonucunda başka bir büroyu seçebiliyor. {ilçe}’de sayfa yapısını netleştiriyoruz. Uygun bir gün var mı?",
  },
  otel: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de oda sorusu çoğu zaman Booking dışında Instagram’a düşüyor. Direkt rezervasyon alan bir vitrin site komisyonu azaltıyor. 15 dakikalık bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, otelinizin sitesini gördüm; direkt rezervasyon zayıfsa komisyon payınız artıyor olabilir. {ilçe}’de hız ve rezervasyon akışını tazeliyoruz. Kısa bir görüşme ayarlayalım mı?",
  },
  insaat: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de referans projeler genelde WhatsApp’ta kayboluyor. Proje galerisi ve teklif formu olan bir kurumsal site bunu toparlıyor. Bu hafta uygun bir gün var mı?",
    yenile: "Merhaba {ad}, firmanızın sitesine baktım; tamamlanan işler güncel değilse ihalede güven kaybı olabiliyor. {ilçe}’de proje ve teklif akışını yeniliyoruz. 10 dakikalık bir görüşme uygun mu?",
  },
  oto: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de servis randevusu ve fiyat sorusu genelde telefonda sıra oluşturuyor. Hizmet listesi + WhatsApp randevu satırı olan bir site bunu hızlandırıyor. Kısa bir örnek gösterebilirim.",
    yenile: "Merhaba {ad}, servisinizin sitesini gördüm; randevu alanı yoksa müşteri başka bir servise gidebiliyor. {ilçe}’de form ve harita görünürlüğünü güncelliyoruz. Uygun bir gün var mı?",
  },
  magaza: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de vitrininiz Instagram’da kalıyorsa satış dükkânda sınırlı kalıyor demektir. Ürün vitrini + WhatsApp sipariş satırı olan bir site bunu genişletiyor. 10 dakikalık bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, mağazanızın sitesine baktım; sayfa yavaş açılıyorsa ziyaretçi tamamlamadan çıkabiliyor. {ilçe}’de hız ve ürün sayfasını tazeliyoruz. Kısa bir teknik not paylaşabilir miyim?",
  },
  lojistik: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de teklif süreci genelde telefonda yazılarak ilerliyor. Hizmet ve teklif formu olan sade bir site bu süreci hızlandırıyor. Bu hafta 10 dakikanız var mı?",
    yenile: "Merhaba {ad}, firmanızın sitesine baktım; teklif formu yoksa iş WhatsApp’ta kaybolabiliyor. {ilçe}’de form ve hat sayfalarını güncelliyoruz. Uygun bir gün var mı?",
  },
  spor: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de üyelik soruları genelde Instagram DM’de birikiyor. Paketleri ve kayıt formunu tek sayfada toplayan bir site bunu sadeleştiriyor. Kısa bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, salonunuzun sitesine baktım; paket ve kayıt sayfası zayıfsa üye adayı kaçıyor olabilir. {ilçe}’de bunu tazeliyoruz. 10 dakikalık bir görüşme ister misiniz?",
  },
  ofis: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de hizmet tarifi sitede yer almazsa teklif genelde referansa kalıyor. Sade bir hizmet + randevu sayfası bunu değiştirebilir. Uygun bir gün var mı?",
    yenile: "Merhaba {ad}, ofisinizin sitesine baktım; hizmetler tek blokta kalmışsa arama sizi atlıyor olabilir. {ilçe}’de sayfa yapısını netleştiriyoruz. Kısa bir görüşme uygun mu?",
  },
  egitim: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de kayıt ve program bilgisi genelde Instagram’da dağınık kalıyor. Program + kayıt formu olan bir site veliye net bir yol gösteriyor. 10 dakikalık bir tanışma uygun mu?",
    yenile: "Merhaba {ad}, kurumunuzun sitesine baktım; kayıt formu yoksa veli genelde WhatsApp’tan yazıyor, bu da takibi zorlaştırıyor. {ilçe}’de program sayfasını tazeliyoruz. Uygun bir gün var mı?",
  },
  generic: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de Google’da telefon numaranız görünüyor ama site yoksa müşteri arama sonucunda rakibe kayabiliyor. Sade bir vitrin site + WhatsApp satırı bunu değiştiriyor. 10 dakikalık bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, işletmenizin sitesine baktım; hız veya form eksikse teklif kaçıyor olabilir. {ilçe}’de bunu birkaç günde toparlıyoruz. Kısa bir görüşme ayarlayalım mı?",
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
