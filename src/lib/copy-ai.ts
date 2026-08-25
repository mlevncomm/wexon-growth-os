import type { Vertical } from "./verticals";

export const WATER_ANGLES = [
  { id: "kirec", label: "Kireç ve lezzet" },
  { id: "maliyet", label: "Damacana maliyeti" },
  { id: "hijyen", label: "Hijyen / sağlık" },
  { id: "isletme", label: "Mutfak ve otel" },
  { id: "takip", label: "Nazik takip" },
] as const;

export const SOFTWARE_ANGLES = [
  { id: "web", label: "Web ve dönüşüm" },
  { id: "otomasyon", label: "Otomasyon" },
  { id: "bakim", label: "Bakım ve hız" },
  { id: "satis", label: "Satış hunisi" },
  { id: "takip", label: "Nazik takip" },
] as const;

export const YKS_ANGLES = [
  { id: "deneme", label: "Deneme ve analiz" },
  { id: "kocluk", label: "Koçluk" },
  { id: "veli", label: "Veli görüşmesi" },
  { id: "kamp", label: "Kamp / program" },
  { id: "takip", label: "Nazik takip" },
] as const;

export const COPY_ANGLES = WATER_ANGLES;

export type CopyAngle = string;

export function copyAngles(vertical: Vertical = "water") {
  if (vertical === "software") return SOFTWARE_ANGLES;
  if (vertical === "yks") return YKS_ANGLES;
  return WATER_ANGLES;
}

export function defaultAngle(vertical: Vertical = "water"): string {
  return copyAngles(vertical)[0]?.id ?? "takip";
}

export function generateSalesCopy(angle: CopyAngle, vertical: Vertical = "water"): { name: string; body: string } {
  if (vertical === "software") {
    switch (angle) {
      case "otomasyon":
        return {
          name: "Yazılım — otomasyon",
          body: "Merhaba {ad}, {ilçe} operasyonunda tekrarlayan işler ekibi yavaşlatır. Sipariş, teklif ve takip adımlarını tek panelde toplayan bir yazılım kuruyoruz. 20 dakikalık bir süreç taraması uygun mu?",
        };
      case "bakim":
        return {
          name: "Yazılım — bakım",
          body: "Merhaba {ad}, yavaş site ve kopuk form {ilçe} adresinizde kayıp satış demek. Hız, yedek ve küçük geliştirmeyi aylık bakıma bağlıyoruz. Kısa bir teknik not paylaşayım mı?",
        };
      case "satis":
        return {
          name: "Yazılım — satış",
          body: "Merhaba {ad}, {ilçe} için web, teklif ve WhatsApp’ı aynı hunide birleştiriyoruz. Hangi kanaldan gelenin müşteri olduğunu net görürsünüz. Bu hafta 15 dakikalık bir harita çıkarabilir miyiz?",
        };
      case "takip":
        return {
          name: "Yazılım — takip",
          body: "Merhaba {ad}, {ilçe} işletmenizde site ve form aynı akışta değilse teklif kaçıyor. Vitrin + WhatsApp satırını netleştiriyoruz. Size uyan bir gün var mı?",
        };
      default:
        return {
          name: "Yazılım — web",
          body: "Merhaba {ad}, {ilçe} işletmesinde site yalnızca vitrin kalırsa teklif kaçıyor. Dönüşümlü sayfa, teklif formu ve takip paneli kuruyoruz. 15 dakikalık bir ihtiyaç görüşmesi uygun mu?",
        };
    }
  }
  if (vertical === "yks") {
    switch (angle) {
      case "kocluk":
        return {
          name: "YKS — koçluk",
          body: "Merhaba {ad}, {ilçe} için öğrenci koçluğu: program, deneme analizi ve veli özeti aynı ritimde. Kontenjan ve deneme gününü kısaca paylaşabilir miyim?",
        };
      case "veli":
        return {
          name: "YKS — veli",
          body: "Merhaba {ad}, {ilçe} velileri net program ve ölçülebilir deneme ister. Akarsu’da haftalık rapor ve birebir takip var. Kısa bir veli görüşmesi ayarlayalım mı?",
        };
      case "kamp":
        return {
          name: "YKS — kamp",
          body: "Merhaba {ad}, {ilçe} için yoğun kamp ve konu tarama programımız açıldı. Kontenjan sınırlı. Uygun bir saatte müfredatı özetleyeyim mi?",
        };
      case "takip":
        return {
          name: "YKS — takip",
          body: "Merhaba {ad}, {ilçe} öğrencilerinde deneme analizi ve koçluk fark yaratır. Akarsu programını kısaca özetleyeyim. Size uyan bir gün var mı?",
        };
      default:
        return {
          name: "YKS — deneme",
          body: "Merhaba {ad}, {ilçe} öğrencilerinde asıl fark deneme analizi ve eksik konu kapanışıdır. Akarsu Akademi’de birebir takip + deneme raporu var. 10 dakikalık bir tanıtım uygun mu?",
        };
    }
  }
  switch (angle) {
    case "kirec":
      return {
        name: "Su arıtma — kireç",
        body: "Merhaba {ad}, {ilçe} işletmesinde kireç hem tadı hem ekipmanı bozar. Restoran ve otel mutfaklarına uygun arıtma ile lezzeti koruyup arıza sıklığını düşürüyoruz. 10 dakikalık bir keşif randevusu uygun mu?",
      };
    case "maliyet":
      return {
        name: "Su arıtma — maliyet",
        body: "Merhaba {ad}, damacana ve kargo {ilçe} işletmelerinde hızla birikir. Tek kurulumla litre maliyetini netleştiriyor, filtre değişimini planlıyoruz. Kısa bir karşılaştırma paylaşmamı ister misiniz?",
      };
    case "hijyen":
      return {
        name: "Su arıtma — hijyen",
        body: "Merhaba {ad}, misafir ve personel suyu {ilçe} adresinizde tabloda görünür bir konu. Kapalı devre arıtma koku, tortu ve kireç şikayetini keser. Uygun bir saatte yerinde bakabilir miyiz?",
      };
    case "isletme":
      return {
        name: "Su arıtma — mutfak",
        body: "Merhaba {ad}, {ilçe} mutfağında çay, buz ve bulaşık hatları kireçten yorulur. Endüstriyel arıtma ile servis sıklığını azaltıyoruz. Bu hafta 15 dakikalık ölçüm ayarlayabilir miyiz?",
      };
    default:
      return {
        name: "Su arıtma — takip",
        body: "Merhaba {ad}, {ilçe} işletmesinde kireç ve damacana maliyeti birikir. Kurulum ve filtre planını kısaca özetleyebilirim. Size uyan bir gün var mı?",
      };
  }
}
