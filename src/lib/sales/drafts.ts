import type { CategoryId, StyleId } from "./categories";
import type { CustomerContext } from "./context";
import { profileFor, type SectorProfile } from "./profiles";

// AI yokken ya da AI yanıtı kullanılamadığında devreye giren yerel taslaklar.
// Her varyasyonun açılışı ve değer sunuşu farklıdır; yalnızca kayıtlı bilgiyi kullanır.

export type LocalDraft = { style: StyleId; message: string; suggestedCTA: string };

const BACK = /[aıou]/;
const HARD = /[fstkçşhp]$/;

/** Türkçe ayrılma eki: Wexon.dev → ’den, Aquails → ’ten */
export function ablative(word: string): string {
  const w = word.toLocaleLowerCase("tr").replace(/[^\p{L}]+$/u, "");
  const vowels = w.match(/[aeıioöuü]/g) ?? ["e"];
  const back = BACK.test(vowels[vowels.length - 1]);
  const d = HARD.test(w) ? "t" : "d";
  return `${word}’${d}${back ? "an" : "en"}`;
}

const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s);

function intros(ctx: CustomerContext) {
  const from = ablative(ctx.brand);
  const s = ctx.senderName;
  const studio = /wexon/i.test(ctx.brand) ? `${ctx.brand} yazılım stüdyosundan` : from;
  return {
    samimi: s ? `Merhaba, ben ${s}, ${from} yazıyorum.` : `Merhaba, ${from} yazıyorum.`,
    profesyonel: s ? `Merhaba, ${studio} ${s} ben.` : `Merhaba, ${studio} yazıyorum.`,
    merak: s ? `Merhaba, ben ${s}, ${from}.` : `Merhaba, ${from} yazıyorum.`,
  };
}

function q(p: SectorProfile, name: string, key: "question" | "automationQuestion" | "funnelQuestion") {
  return p[key].replaceAll("{isim}", name);
}

function when(days: number | null): string {
  if (days === null) return "Daha önce";
  if (days <= 2) return "Geçen gün";
  if (days <= 10) return "Geçen hafta";
  return "Bir süre önce";
}

type Objection = "ihtiyac" | "butce" | "site_var" | "dusunecek" | "genel";

export function objectionType(reply: string): Objection {
  const r = reply.toLocaleLowerCase("tr");
  if (/(sitemiz var|site(miz)? zaten|zaten (bir )?site|web sitemiz)/.test(r)) return "site_var";
  if (/(bütçe|butce|pahalı|para yok|maliyet|ödeyemeyiz)/.test(r)) return "butce";
  if (/(düşüneyim|düşünelim|düşüneceğim|sonra konuşalım|şimdilik değil|ileride)/.test(r)) return "dusunecek";
  if (/(ihtiyac|ihtiyaç|gerek yok|gerekmiyor|istemiyoruz|ilgilenmiyoruz|lazım değil)/.test(r)) return "ihtiyac";
  return "genel";
}

export function localDrafts(ctx: CustomerContext, category: CategoryId): LocalDraft[] {
  const p = profileFor(ctx.sector.id);
  const i = intros(ctx);
  const n = ctx.shortName;
  const brand = ctx.brand;
  const hasSite = ctx.website.kind === "site";

  switch (category) {
    case "ilk_temas": {
      if (ctx.designLink) {
        const l = ctx.designLink;
        return [
          { style: "samimi", message: `${i.samimi} ${n} için örnek bir web sitesi taslağı hazırladım, buradan bakabilirsiniz: ${l} ${cap(p.web)} bir yapı düşündüm. Beğendiğiniz ya da değişsin dediğiniz bir yer olursa buradan yazmanız yeterli.`, suggestedCTA: "Değişiklik isteğini yazmaya davet" },
          { style: "profesyonel", message: `${i.profesyonel} ${n} için hazırladığım örnek tasarımı paylaşıyorum: ${l} Amaç, ${p.flow} almayı kolaylaştıran sade bir yapı. Uygun görürseniz kendi içeriklerinizle yayına almayı konuşabiliriz; ne düşündüğünüzü merak ediyorum.`, suggestedCTA: "Görüş isteme" },
          { style: "merak", message: `${i.merak} ${n} için bir taslak hazırladım: ${l} En çok ${p.flow} bölümüne özen gösterdim. Bir bakıp ilk izleniminizi yazarsanız ona göre düzenleyebilirim.`, suggestedCTA: "İlk izlenim isteme" },
        ];
      }
      const idea = hasSite
        ? `mevcut sitenize ek olarak ziyaretçinin ${p.flow} bırakmasını kolaylaştıran küçük bir düzen`
        : `${p.web} bir web sitesi`;
      return [
        { style: "samimi", message: `${i.samimi} ${n} için aklımda ${idea} fikri var. ${p.benefit} Uygun olursa kısaca anlatayım mı?`, suggestedCTA: "Kısaca anlatmak için izin isteme" },
        {
          style: "profesyonel",
          message: hasSite
            ? `${i.profesyonel} ${n} için mevcut sitenizle birlikte çalışan bir ${p.flow} akışının gelen talepleri tek yerde toplamayı kolaylaştırabileceğini düşündüm. Bu tür yapıları ${p.audience} için kuruyoruz; isterseniz kısa bir örnek üzerinden göstereyim.`
            : `${i.profesyonel} ${n} için ${p.web} bir web sitesinin işinize yarayabileceğini düşündüm. Bu tür siteleri ${p.audience} için hazırlıyoruz; isterseniz kısa bir örnek üzerinden göstereyim.`,
          suggestedCTA: "Örnek gösterme teklifi",
        },
        { style: "merak", message: `${i.merak} Kısa bir sorum olacak: ${q(p, n, "question")} Sorma sebebim, ${p.audience} için bu talepleri tek yerde toplayan sade web yapıları kurmamız. İsterseniz nasıl işe yarayabileceğini iki cümleyle anlatayım.`, suggestedCTA: "Keşif sorusu" },
      ];
    }
    case "otomasyon":
      return [
        { style: "samimi", message: `${i.samimi} ${cap(p.audience)} için tekrar eden takip işleri gün içinde epey zaman alabiliyor. ${n} için ${p.automation} küçük bir sistem kurabiliriz. Bu iş sizde şu an nasıl yürüyor?`, suggestedCTA: "Mevcut süreci sorma" },
        { style: "profesyonel", message: `${i.profesyonel} İşletmelerde tekrar eden işleri kolaylaştıran küçük sistemler kuruyoruz; ${p.audience} için örneğin ${p.automation} bir yapı. ${n} için uygun olup olmadığını kısa bir yazışmayla netleştirebiliriz. İlgilenir misiniz?`, suggestedCTA: "İlgi sorma" },
        { style: "merak", message: `${i.merak} ${n} için kısa bir sorum var: ${q(p, n, "automationQuestion")} Bunu ${p.automation} bir sistemle kolaylaştırmak mümkün; isterseniz nasıl çalıştığını anlatayım.`, suggestedCTA: "Süreç sorusu" },
      ];
    case "bakim":
      return [
        { style: "samimi", message: `${i.samimi} Web sitesi olan işletmelere bakım desteği veriyoruz; ${p.care} güncel kalmasıyla, yedeklemeyle ve küçük düzeltmelerle biz ilgileniyoruz. ${n} için bu işlerle ilgilenecek birine ihtiyaç olursa yardımcı olabilirim. Şu an sitenizi kim güncelliyor?`, suggestedCTA: "Mevcut durumu sorma" },
        { style: "profesyonel", message: `${i.profesyonel} ${n} sitesi için aylık bakım ve geliştirme desteği sunabiliriz; ${p.care} takibi, yedekleme ve güncellemeler tek elden ilerler. Uygun görürseniz sitenize göz atıp kısa bir değerlendirme gönderebilirim.`, suggestedCTA: "Değerlendirme teklifi" },
        { style: "merak", message: `${i.merak} ${n} için kısa bir sorum olacak: sitede ${p.care} güncellenmesi gerektiğinde bunu kendiniz kolayca yapabiliyor musunuz? Bu tür işleri hızlıca hallettiğimiz bir bakım desteği veriyoruz; ihtiyaç olursa buradayım.`, suggestedCTA: "Güncelleme kolaylığını sorma" },
      ];
    case "huni":
      return [
        { style: "samimi", message: `${i.samimi} ${cap(p.audience)} için ${p.funnel} sağlayan sade akışlar kuruyoruz. ${n} için de böyle bir düzen işinizi kolaylaştırabilir. Uygun olursa kısaca anlatayım mı?`, suggestedCTA: "Anlatma izni" },
        { style: "profesyonel", message: `${i.profesyonel} Müşterinin sizi bulduğu andan ${p.flow} bırakmasına kadarki adımları sadeleştiren yapılar kuruyoruz; site, form ve WhatsApp aynı akışta çalışıyor ve talepler tek listede toplanıyor. ${n} için uygun olup olmadığını konuşmak ister misiniz?`, suggestedCTA: "Görüşme isteği" },
        { style: "merak", message: `${i.merak} ${n} için merak ettiğim bir şey var: ${q(p, n, "funnelQuestion")} Bunu görünür kılan sade bir akış kurabiliyoruz; isterseniz kısa bir örneğini paylaşayım.`, suggestedCTA: "Takip sorusu" },
      ];
    case "takip": {
      if (!ctx.previousContacts.length) return localDrafts(ctx, hasSite ? "huni" : "ilk_temas");
      const w = when(ctx.daysSinceContact);
      const s = ctx.senderName;
      const from = ablative(brand);
      return [
        { style: "samimi", message: `Merhaba, ${s ? `${s} ben, ${from}.` : `${from} yazıyorum.`} ${w} ${n} için kısa bir mesaj göndermiştim. Şu an gündeminizde değilse hiç sorun değil; ileride ${p.flow} tarafında bir ihtiyaç olursa buradayım.`, suggestedCTA: "Kapıyı açık bırakma" },
        { style: "profesyonel", message: `Merhaba, ${brand} ekibinden ${s || "yazıyorum"}. ${w} ${n} için bir öneri paylaşmıştım. Aklınıza takılan bir soru olursa yanıtlamaktan memnun olurum; uygun değilse söylemeniz yeterli, tekrar yazmam.`, suggestedCTA: "Soru ya da ret kolaylığı" },
        { style: "merak", message: `Merhaba, ${s ? `ben ${s}, ${from}.` : `${from} yazıyorum.`} Önceki mesajıma kısa bir ek yapayım: ${p.tip}. ${n} için de uygulanabilir; isterseniz bir örneğini paylaşayım.`, suggestedCTA: "Yeni bilgiyle örnek teklif" },
      ];
    }
    case "ilgili":
      return [
        { style: "samimi", message: `Dönüşünüz için teşekkürler, sevindim. Size doğru şeyi önerebilmem için kısaca sorayım: ${p.discovery}`, suggestedCTA: "İhtiyaç keşfi" },
        { style: "profesyonel", message: `Teşekkür ederim. ${n} için en uygun yapıyı çıkarabilmem adına önce ihtiyacı netleştirmek isterim. ${p.discovery} Bir de sitenin ne zamana kadar hazır olması işinize yarar, onu yazarsanız ona göre plan çıkarırım.`, suggestedCTA: "Kapsam ve zaman" },
        { style: "merak", message: `Çok iyi. İsterseniz 10 dakikalık kısa bir telefon görüşmesinde ihtiyacınızı dinleyeyim, ardından size net bir öneri ve fiyat göndereyim. Bugün ya da yarın hangi saat uygun olur?`, suggestedCTA: "Kısa görüşme" },
      ];
    case "fiyat": {
      const price = ctx.startPrice;
      if (price) {
        return [
          { style: "samimi", message: `Tabii, açıkça söyleyeyim: tek sayfalık bir site ${price}’den başlıyor. Sayfa sayısı, ${p.flow} formu ya da yönetim paneli gibi eklemeler fiyatı değiştiriyor. ${n} için neye ihtiyaç olduğunu netleştirirsek size kesin rakamı söyleyebilirim; birkaç kısa soru sorabilir miyim?`, suggestedCTA: "Kapsam soruları" },
          { style: "profesyonel", message: `Fiyat kapsama göre değişiyor; başlangıç paketimiz ${price}. İçerik, sayfa sayısı ve ek özellikler teklifi netleştiriyor. ${n} için ihtiyacınızı kısaca yazarsanız size kalem kalem bir teklif hazırlayabilirim.`, suggestedCTA: "İhtiyacı yazmaya davet" },
          { style: "merak", message: `Kısa cevap: ${price}’den başlıyor. Gerisi kapsama bağlı; ${p.flow} formu, sayfa sayısı ve içerik hazırlığı fiyatı etkiliyor. Neler olsun istediğinizi yazarsanız size net rakamı söyleyeyim.`, suggestedCTA: "Net rakam için bilgi" },
        ];
      }
      return [
        { style: "samimi", message: `Tabii, fiyat tamamen kapsama göre değişiyor: sayfa sayısı, ${p.flow} formu ya da yönetim paneli gibi eklemeler rakamı belirliyor. ${n} için neye ihtiyaç olduğunu netleştirirsek size kesin rakamı söyleyebilirim; birkaç kısa soru sorabilir miyim?`, suggestedCTA: "Kapsam soruları" },
        { style: "profesyonel", message: `Fiyatı kapsam belirliyor; içerik, sayfa sayısı ve ek özellikler teklifi netleştiriyor. ${n} için ihtiyacınızı kısaca yazarsanız size kalem kalem bir teklif hazırlayabilirim.`, suggestedCTA: "İhtiyacı yazmaya davet" },
        { style: "merak", message: `Tahmini bir rakam söyleyip yanıltmak istemem; ${p.flow} formu, sayfa sayısı ve içerik hazırlığı fiyatı doğrudan etkiliyor. Neler olsun istediğinizi yazarsanız size net bir rakamla döneyim.`, suggestedCTA: "Net rakam için bilgi" },
      ];
    }
    case "itiraz": {
      const t = objectionType(ctx.customerReply);
      if (t === "site_var") {
        return [
          { style: "samimi", message: `Ne güzel, o zaman yeni bir site önermeyeyim. Mevcut sitenizde güncelleme ya da ${p.flow} tarafında destek gerekirse yardımcı olabilirim. İyi çalışmalar dilerim.`, suggestedCTA: "Kapıyı açık bırakma" },
          { style: "profesyonel", message: `Anladım, teşekkürler. Sitenizin bakımı ve küçük geliştirmeleri için destek gerekirse bu numaradan bana ulaşabilirsiniz; şu an başka bir öneriyle meşgul etmeyeyim.`, suggestedCTA: "Bakım desteği hatırlatma" },
          { style: "merak", message: `Anladım, teşekkür ederim. Merak ettiğim tek şey şu, cevaplamak zorunda değilsiniz: sitedeki bilgileri güncellemek sizin için kolay mı? Değilse bu konuda yardımcı olabilirim.`, suggestedCTA: "Güncelleme sorusu" },
        ];
      }
      if (t === "butce") {
        return [
          { style: "samimi", message: `Anlıyorum, bütçe şu an önemli bir konu. Tek sayfalık sade bir başlangıçla ilerleyip ihtiyaç oldukça genişletmek de mümkün. İsterseniz bütçenize uygun en küçük kapsamı birlikte çıkaralım.`, suggestedCTA: "Küçük kapsam önerisi" },
          { style: "profesyonel", message: `Anladım, açık yazdığınız için teşekkürler. Uygun olduğunuz bir bütçe aralığı varsa yazın; o aralıkta neler yapılabileceğini dürüstçe söylerim, uygun değilse de zorlamam.`, suggestedCTA: "Bütçe aralığı sorma" },
          { style: "merak", message: `Anlıyorum. Bazı işletmeler önce yalnızca iletişim ve ${p.flow} sayfasıyla başlıyor, gerisini sonra ekliyor. Böyle küçük bir başlangıç sizin için düşünülebilir mi?`, suggestedCTA: "Aşamalı başlangıç" },
        ];
      }
      if (t === "dusunecek") {
        return [
          { style: "samimi", message: `Tabii, acelesi yok. Aklınıza takılan bir şey olursa buradan yazabilirsiniz; ben de sizi gereksiz yere meşgul etmeyeyim.`, suggestedCTA: "Baskısız bekleme" },
          { style: "profesyonel", message: `Elbette, teşekkürler. Karar verirken işinize yarayacak bir bilgi ya da örnek isterseniz göndermekten memnun olurum.`, suggestedCTA: "Bilgi teklifi" },
          { style: "merak", message: `Tabii. Düşünürken netleştirmek istediğiniz bir konu varsa, fiyat, süre ya da içerik, tek mesajla sorabilirsiniz; kısa ve net cevap veririm.`, suggestedCTA: "Soru davetiyesi" },
        ];
      }
      return [
        { style: "samimi", message: `Anlıyorum, bilgi verdiğiniz için teşekkürler. İleride ${p.flow} tarafında bir ihtiyaç olursa bu numaradan bana ulaşabilirsiniz. İyi çalışmalar dilerim.`, suggestedCTA: "Kapıyı açık bırakma" },
        { style: "profesyonel", message: `Anladım, teşekkür ederim. Rahatsız etmek istemem; uygun görürseniz birkaç ay sonra kısa bir hatırlatma yapayım, istemezseniz hiç yazmam. Hangisi sizin için uygun?`, suggestedCTA: "Hatırlatma izni" },
        { style: "merak", message: `Tamamdır, teşekkürler. Şu an ${p.flow} tarafında her şey yolunda ilerliyorsa ne güzel. Bir gün ihtiyaç olursa buradayım, iyi çalışmalar.`, suggestedCTA: "Kapıyı açık bırakma" },
      ];
    }
    case "kapanis":
      return [
        { style: "samimi", message: "Anladım, bilgi verdiğiniz için teşekkür ederim. Sizi bir daha bu konuda rahatsız etmeyeceğim. İyi çalışmalar dilerim.", suggestedCTA: "Yok" },
        { style: "profesyonel", message: "Tamamdır, kaydınızı kapattım; tekrar mesaj göndermeyeceğim. Vakit ayırdığınız için teşekkürler, kolay gelsin.", suggestedCTA: "Yok" },
        { style: "merak", message: "Anlıyorum, teşekkürler. Bir gün ihtiyacınız olursa bu numaradan ulaşabilirsiniz; bizden tekrar mesaj gelmeyecek. İyi çalışmalar.", suggestedCTA: "Yok" },
      ];
  }
}
