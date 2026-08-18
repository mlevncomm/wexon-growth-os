export const COPY_ANGLES = [
  { id: "kirec", label: "Kireç ve lezzet" },
  { id: "maliyet", label: "Damacana maliyeti" },
  { id: "hijyen", label: "Hijyen / sağlık" },
  { id: "isletme", label: "Mutfak ve otel" },
  { id: "takip", label: "Nazik takip" },
] as const;

export type CopyAngle = (typeof COPY_ANGLES)[number]["id"];

export function generateSalesCopy(angle: CopyAngle): { name: string; body: string } {
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
        body: "Merhaba {ad}, {ilçe} için su arıtma keşif notunu hazırladık. Filtre ömrü ve kurulum bedelini tek sayfada özetleyebilirim. Size uyan bir gün var mı?",
      };
  }
}
