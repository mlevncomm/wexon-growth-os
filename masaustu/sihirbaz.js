// Kurulum sihirbazı: kurulum.ps1 çıktısını adımlara çevirir.
const $ = (id) => document.getElementById(id);
const w = window.wexon;

const ADIM = { "3/6": "a1", "4/6": "a2", "6/6": "a3" };
let aktif = null;
let uyariVar = false;
let kontrolModu = false;
const uyariYazi = () => (kontrolModu ? "Yapılacak" : "Kontrol et");

function adim(id, durum, yazi) {
  const el = $(id); if (!el) return;
  el.dataset.s = durum;
  el.querySelector(".st").textContent = yazi;
  el.querySelector(".ico").textContent = durum === "tamam" ? "✓" : durum === "dikkat" ? "!" : el.id.slice(1);
}
function sifirla() {
  for (const id of ["a1", "a2", "a3"]) adim(id, "bekliyor", "Bekliyor");
  $("gunluk").textContent = ""; aktif = null; uyariVar = false;
  $("sonuc").hidden = true;
}
function sonuc(sinif, html) { const el = $("sonuc"); el.className = "note " + sinif; el.innerHTML = html; el.hidden = false; }
function kilitle(k) { for (const id of ["baslat", "kontrol", "atla"]) $(id).disabled = k; }

w.satirGelince((s) => {
  const pre = $("gunluk");
  const span = document.createElement("span");
  span.textContent = s + "\n";
  if (/^== /.test(s)) span.className = "head";
  else if (/\[tamam\]/.test(s)) span.className = "ok";
  else if (/\[dikkat\]/.test(s)) span.className = "warn";
  else if (/\[yapılacak\]/.test(s)) span.className = "plan";
  else if (/HATA|doğrulanamadı|görünmüyor|bulunamadı/i.test(s)) span.className = "bad";
  pre.appendChild(span); pre.scrollTop = pre.scrollHeight;

  const m = s.match(/^== (\d\/6)/);
  if (m) {
    if (aktif) adim(aktif, uyariVar ? "dikkat" : "tamam", uyariVar ? uyariYazi() : "Tamam");
    aktif = ADIM[m[1]] || null; uyariVar = false;
    if (aktif) adim(aktif, "calisiyor", "Sürüyor…");
  }
  if (/\[dikkat\]|\[yapılacak\]/.test(s)) uyariVar = true;
  if (/indiriliyor|Yönetici izni/.test(s)) $("izin").hidden = false;
});

async function calistir(kontrol) {
  sifirla(); kilitle(true); kontrolModu = kontrol;
  $("izin").hidden = kontrol;
  const kod = await w.kurulum(kontrol);
  if (aktif) adim(aktif, uyariVar ? "dikkat" : "tamam", uyariVar ? uyariYazi() : "Tamam");
  adim("a3", "dikkat", "Senin adımın");
  kilitle(false); $("izin").hidden = true;
  if (kontrol) {
    sonuc("", "Kontrol bitti, hiçbir şey değiştirilmedi. <b>Mor</b> satırlar kurulumda yapılacakları gösterir (Ayrıntılar).");
    $("ayrinti").open = true;
  } else if (kod === 0) {
    sonuc("", "<b>Kurulum tamam.</b> Telefon Bağlantısı'nda iPhone'u eşleştir, sonra Wexon Growth OS'u aç ve giriş yap.");
    $("baslat").hidden = true; $("kontrol").hidden = true; $("atla").hidden = true;
    $("telefon").hidden = false; $("ac").hidden = false;
  } else if (kod === 10) {
    sonuc("warn", "<b>Sürücüler kuruldu.</b> Windows'un yeni ses cihazlarını görmesi için bilgisayarı yeniden başlat. Tekrar oturum açınca kurulum kendiliğinden devam edecek.");
    $("baslat").hidden = true; $("kontrol").hidden = true; $("yeniden").hidden = false;
  } else {
    sonuc("bad", "<b>Kurulum tamamlanamadı.</b> Ayrıntılar'daki kırmızı satıra bak; sorunu giderip tekrar dene.");
    $("ayrinti").open = true;
  }
}

$("baslat").onclick = () => calistir(false);
$("kontrol").onclick = () => calistir(true);
$("yeniden").onclick = () => { $("yeniden").disabled = true; $("yeniden").textContent = "Yeniden başlatılıyor…"; w.yenidenBaslat(); };
$("telefon").onclick = () => w.telefon();
$("ac").onclick = () => w.uygulamayiAc();
$("atla").onclick = () => w.uygulamayiAc();
$("adresKaydet").onclick = async () => {
  const r = await w.adresKaydet($("adres").value);
  $("adresKaydet").textContent = r.ok ? "Kaydedildi ✓" : "Geçersiz adres";
  if (r.ok) $("adres").value = r.adres;
  setTimeout(() => { $("adresKaydet").textContent = "Adresi kaydet"; }, 2000);
};

(async () => {
  const b = await w.bilgi();
  $("surum").textContent = "sürüm " + b.surum;
  $("kadi").textContent = b.kullanici || "—";
  $("adres").value = b.adres;
  if (/wexon/i.test(b.kullanici)) $("kullanici").innerHTML = `Ayrı arama kullanıcısındasın: <b>${b.kullanici.replace(/[<>&]/g, "")}</b>. Ses ayarları sadece bu kullanıcıda değişir.`;
  // Yeniden başlatmadan sonra kendiliğinden devam
  if (b.devam) calistir(false);
})();
