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
    web: "{ad} için online bir site olmadığında randevu talepleri genelde WhatsApp ve telefon arasında dağılabiliyor, özellikle yoğun saatlerde müşteriyi takip etmek zorlaşabiliyor. Ben Wexon.dev’den yazıyorum; randevu almayı kolaylaştıran, hizmetleri ve fiyatları düzenli gösteren sade bir site hazırlayabiliriz, {ilçe} tarafında böyle bir çalışma düşünür müsünüz?",
    yenile: "{ad} için mevcut sitenize baktım; hizmetler ve iletişim bilgileri biraz daha güncel ve düzenli sunulsa müşterinin aradığını bulması kolaylaşabilir. Wexon.dev olarak mobilde daha modern görünen, hizmetleri öne çıkaran ve randevu talebini sadeleştiren bir yapı hazırlayabiliriz, örnek bir tasarıma bakmak ister misiniz?",
  },
  restoran: {
    web: "{ad} hakkında bilgi arayan müşteriler menüye, çalışma saatlerine veya rezervasyona ulaşmak için çoğu zaman Instagram ve WhatsApp arasında dolaşıyor. Wexon.dev olarak menünüzü ve mekan bilgilerinizi tek yerde toplayan, telefondan kolay kullanılan bir site hazırlayabiliriz; {ilçe} için böyle bir çözüm ilginizi çeker mi?",
    yenile: "{ad} sitesine göz attım; menü bölümü ve rezervasyon akışı biraz eski bir kullanım hissi veriyor, özellikle telefonda daha sade bir yapı faydalı olabilir. Wexon.dev olarak menüyü daha düzenli sergileyen ve rezervasyon talebini kolaylaştıran yeni bir arayüz tasarlayabiliriz, nasıl görüneceğine bakmak ister misiniz?",
  },
  kafe: {
    web: "{ad} gibi bir kafede müşteriler menüye ve konuma hızlıca ulaşmak isterken bilgiler yalnızca Instagram’da kaldığında bazı sorular tekrar tekrar WhatsApp’a gelebiliyor. Wexon.dev olarak menü, konum, çalışma saatleri ve iletişim bilgilerini tek sayfada buluşturan modern bir site hazırlayabiliriz, uygun olur mu?",
    yenile: "{ad} için mevcut siteyi inceledim; menüye ulaşmak birkaç adım gerektiriyor ve mobil görünüm biraz daha ferah bir düzenle toparlanabilir. Wexon.dev olarak menüyü öne çıkaran, konumu kolay gösteren ve telefonda rahat kullanılan yeni bir tasarım oluşturabiliriz, görmek ister misiniz?",
  },
  klinik: {
    web: "{ad} için randevu talepleri yalnızca WhatsApp üzerinden geldiğinde yoğun saatlerde mesajların arasında müşteri takibi zorlaşabiliyor. Wexon.dev olarak hizmetlerinizi, fiyat bilgilerinizi ve randevu talebini tek yerde toplayan sade bir site hazırlayabiliriz; {ilçe} bölgesindeki müşterileriniz için böyle bir yapı düşünür müsünüz?",
    yenile: "{ad} sitesine göz attım; hizmetler ve randevu bölümü biraz eski görünüyor, özellikle mobilde daha temiz bir sunumla müşterinin karar vermesi kolaylaşabilir. Wexon.dev olarak hizmetleri görsel biçimde öne çıkaran ve randevu talebini kısaltan yeni bir tasarım hazırlayabiliriz, incelemek ister misiniz?",
  },
  dis: {
    web: "{ad} hakkında bilgi arayan bir hasta hizmetleri, doktor bilgilerini ve randevu seçeneklerini tek yerde göremediğinde doğrudan telefon veya WhatsApp’a yönelmek zorunda kalabiliyor. Wexon.dev olarak kliniğinizi güven veren ve sade bir şekilde tanıtan, randevu talebini kolaylaştıran bir site hazırlayabiliriz; uygun olur mu?",
    yenile: "{ad} sitesine göz attım; hizmetler ve randevu bilgileri biraz daha belirgin hale getirilirse özellikle mobil ziyaretçiler için kullanım kolaylaşabilir. Wexon.dev olarak kliniğin hizmetlerini daha düzenli sunan ve randevu talebine kısa yoldan ulaştıran modern bir tasarım hazırlayabiliriz, incelemek ister misiniz?",
  },
  emlak: {
    web: "{ad} için ilanlara bakan kişiler yalnızca sosyal medya veya ilan platformlarına yönlendirildiğinde işletmenin tüm hizmetlerini tek yerde görmek zorlaşabiliyor. Wexon.dev olarak portföyünüzü, hizmetlerinizi ve iletişim bilgilerinizi düzenli biçimde sunan modern bir site hazırlayabiliriz; {ilçe} için böyle bir çalışma düşünür müsünüz?",
    yenile: "{ad} sitesini inceledim; ilanların sunumu ve iletişim bölümü biraz eski bir yapıda kalmış, güncel portföyü daha görsel ve anlaşılır göstermek mümkün. Wexon.dev olarak mobil odaklı, portföyü öne çıkaran ve iletişim sürecini sadeleştiren yeni bir site tasarlayabiliriz, örneğine bakmak ister misiniz?",
  },
  muhasebe: {
    web: "{ad} için hizmet almak isteyen işletmeler hangi konularda destek verdiğinizi çoğu zaman telefon veya WhatsApp üzerinden öğrenmek durumunda kalabiliyor. Wexon.dev olarak muhasebe hizmetlerinizi anlaşılır şekilde anlatan, iletişim talebini kolaylaştıran ve telefonda rahat kullanılan bir site hazırlayabiliriz; böyle bir çalışma size uygun olur mu?",
    yenile: "{ad} sitesini inceledim; hizmetlerin anlatımı ve iletişim alanı biraz eski bir düzende kalmış, bilgiler daha net bölümlere ayrılabilir. Wexon.dev olarak hizmetlerinizi daha profesyonel gösteren ve potansiyel müşterinin size ulaşmasını kolaylaştıran bir tasarım hazırlayabiliriz, yeni görünümü görmek ister misiniz?",
  },
  avukat: {
    web: "{ad} hakkında araştırma yapan biri uzmanlık alanlarınızı ve iletişim bilgilerinizi tek yerde göremediğinde size ulaşmadan önce farklı kaynaklara bakmak zorunda kalabiliyor. Wexon.dev olarak çalışma alanlarınızı sade biçimde anlatan, mobil uyumlu ve iletişim talebini kolaylaştıran profesyonel bir site oluşturabiliriz; {ilçe} için düşünür müsünüz?",
    yenile: "{ad} sitesine baktım; uzmanlık alanları ve iletişim bölümü biraz daha sade bir hiyerarşiyle sunulabilir, mevcut görünüm de güncel bir dokunuştan fayda görebilir. Wexon.dev olarak daha kurumsal görünen ve ziyaretçiyi iletişime yönlendiren yeni bir yapı tasarlayabiliriz, bir örneğine bakmak ister misiniz?",
  },
  otel: {
    web: "{ad} için konaklama araştıran misafirler oda bilgilerini ve fiyatları görmek istediğinde çoğunlukla rezervasyon platformlarına yönlendiriliyor, bu da komisyonsuz direkt rezervasyon şansını azaltıyor. Wexon.dev olarak odaları, olanakları ve direkt rezervasyon talebini toplayan bir site hazırlayabiliriz; ilgilenir misiniz?",
    yenile: "{ad} sitesini inceledim; oda görselleri ve rezervasyon akışı biraz eski bir yapıda kalmış. Wexon.dev olarak direkt rezervasyonu kolaylaştıran, mobilde daha akıcı çalışan yeni bir tasarım hazırlayabiliriz, bakmak ister misiniz?",
  },
  insaat: {
    web: "{ad} için tadilat veya inşaat hizmeti arayan biri yaptığınız işleri ve hangi alanlarda çalıştığınızı hızlıca görmek isteyebilir, bunlar yalnızca WhatsApp’ta kalınca seçim yapmak zorlaşıyor. Wexon.dev olarak projelerinizi ve hizmetlerinizi sergileyen modern bir site hazırlayabiliriz; {ilçe} için değerlendirmek ister misiniz?",
    yenile: "{ad} sitesine baktım; yapılan işlerin sunumu ve hizmet açıklamaları biraz eski görünüyor, projeleri daha güçlü gösterecek bir düzen kurulabilir. Wexon.dev olarak referansları öne çıkaran, telefonda rahat gezilen ve teklif talebini kolaylaştıran yeni bir site tasarlayabiliriz, örneğini görmek ister misiniz?",
  },
  oto: {
    web: "{ad} için müşteriler arıza veya bakım konusunda bilgi almak istediğinde telefon ve WhatsApp trafiği gün içinde epey dağılabiliyor. Wexon.dev olarak hizmetleri, iletişim seçeneklerini ve talep formunu tek yerde toplayan sade bir site kurabiliriz; {ilçe} bölgesindeki müşterilerin size daha kolay ulaşması için değerlendirmek ister misiniz?",
    yenile: "{ad} sitesine baktım; hizmetler ve iletişim alanları biraz eski görünüyor, özellikle telefondan hızlıca bilgi almak isteyen biri için daha net bir akış oluşturulabilir. Wexon.dev olarak servis hizmetlerini düzenli gösteren ve iletişim talebini kolaylaştıran bir tasarım hazırlayabiliriz, yeni halini görmek ister misiniz?",
  },
  magaza: {
    web: "Merhaba {ad}, Wexon.dev’den yazıyorum. {ilçe}’de vitrininiz Instagram’da kalıyorsa satış dükkânda sınırlı kalıyor demektir. Ürün vitrini + WhatsApp sipariş satırı olan bir site bunu genişletiyor. 10 dakikalık bir görüşme uygun mu?",
    yenile: "Merhaba {ad}, mağazanızın sitesine baktım; sayfa yavaş açılıyorsa ziyaretçi tamamlamadan çıkabiliyor. {ilçe}’de hız ve ürün sayfasını tazeliyoruz. Kısa bir teknik not paylaşabilir miyim?",
  },
  lojistik: {
    web: "{ad} için taşınma teklifi almak isteyen müşteriler hizmet bölgelerini ve süreci öğrenmek için tekrar tekrar WhatsApp’tan yazmak zorunda kalıyor. Wexon.dev olarak hizmet bölgelerinizi anlatan ve ön teklif formu içeren sade bir site hazırlayabiliriz; {ilçe} için değerlendirir misiniz?",
    yenile: "{ad} sitesine baktım; teklif alma adımı biraz geride kalmış ve hizmetler net ayrılmamış. Wexon.dev olarak teklif formunu öne çıkaran, mobilde rahat kullanılan yeni bir düzen kurabiliriz, örneğine bakmak ister misiniz?",
  },
  spor: {
    web: "{ad} hakkında bilgi almak isteyen biri üyelik, ders programı ve iletişim detaylarını farklı yerlerde aradığında karar vermesi gereğinden fazla uzayabiliyor. Wexon.dev olarak salonunuzu tanıtan, programları düzenli gösteren ve deneme ya da üyelik talebini kolaylaştıran bir site oluşturabiliriz; {ilçe} için ilgilenir misiniz?",
    yenile: "{ad} sitesine baktım; ders programı ve üyelik bilgileri biraz daha görünür olsa ziyaretçinin aradığına ulaşması kolaylaşabilir, genel görünüm de güncellenebilir. Wexon.dev olarak mobilde daha akıcı çalışan, programı öne çıkaran yeni bir arayüz tasarlayabiliriz, görmek ister misiniz?",
  },
  ofis: {
    web: "Merhaba {ad}, Wexon.dev’den selam. {ilçe}’de hizmet tarifi sitede yer almazsa teklif genelde referansa kalıyor. Sade bir hizmet + randevu sayfası bunu değiştirebilir. Uygun bir gün var mı?",
    yenile: "Merhaba {ad}, ofisinizin sitesine baktım; hizmetler tek blokta kalmışsa arama sizi atlıyor olabilir. {ilçe}’de sayfa yapısını netleştiriyoruz. Kısa bir görüşme uygun mu?",
  },
  egitim: {
    web: "{ad} hakkında bilgi almak isteyen öğrenciler veya veliler kurs programını, eğitimleri ve kayıt sürecini farklı kanallardan takip etmek zorunda kalabiliyor. Wexon.dev olarak eğitimlerinizi düzenli anlatan, programları kolay gösteren ve kayıt talebini sadeleştiren bir site hazırlayabiliriz; {ilçe} için böyle bir çalışma düşünür müsünüz?",
    yenile: "{ad} sitesine göz attım; kurs programları ve eğitim bilgileri biraz eski bir düzende sunulmuş, içerikler daha anlaşılır şekilde gruplanabilir. Wexon.dev olarak mobilde daha modern görünen ve kayıt sürecine yönlendiren yeni bir yapı tasarlayabiliriz, nasıl göründüğüne bakmak ister misiniz?",
  },
  generic: {
    web: "{ad} için sizi ilk kez araştıran bir müşterinin hizmetlerinizi, konumunuzu ve size nasıl ulaşacağını tek yerde bulabilmesi işleri kolaylaştırabilir; yalnızca sosyal medya veya WhatsApp’a bağlı kalmak bazı talepleri dağıtabiliyor. Wexon.dev olarak işletmenize uygun sade bir site hazırlayabiliriz, ilgilenir misiniz?",
    yenile: "{ad} sitesine baktım; genel yapı biraz eski görünüyor ve bazı bilgiler daha düzenli bir şekilde öne çıkarılabilir, özellikle mobil kullanım tarafında sadeleşme faydalı olabilir. Wexon.dev olarak işletmenizin tarzına uygun, daha modern ve iletişime odaklanan bir site tasarlayabiliriz, örneğine bakmak ister misiniz?",
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
