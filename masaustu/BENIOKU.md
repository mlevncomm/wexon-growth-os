# Wexon Growth OS — Masaüstü Programı

Growth OS'u kendi penceresinde açan Windows programı. Ece'nin telefon araması için gereken her şeyi ilk açılıştaki **kurulum sihirbazı** hazırlar.

- Kendi simgesi, Başlat menüsü ve masaüstü kısayolu olan gerçek bir program (Chrome gerekmez).
- Ece müşteriyi **doğrudan sesinden dinler** (yapay zekâ sesi yazıya çevirmeden duyar; tonu ve duraksamayı da anlar).
- Telefon Bağlantısı penceresi öndeyken bile arka planda dinlemeye ve konuşmaya devam eder; görüşme sırasında bilgisayar uyumaz.
- WhatsApp ve harita bağlantıları normal tarayıcıda açılır.

## Kurulum

### 1. Ayrı bir Windows kullanıcısı aç (önerilen)

Arama kullanıcısında hoparlör ve mikrofon telefona yönlendirilir; senin normal kullanıcın etkilenmesin diye:
**Ayarlar → Hesaplar → Diğer kullanıcılar → Hesap ekle →** "Bu kişinin oturum açma bilgilerine sahip değilim" → "Microsoft hesabı olmadan kullanıcı ekle" → ad: **Wexon Growth**. Bu kullanıcıyla oturum aç.

### 2. Programı kur

**`Wexon-Growth-OS-Kurulum-1.0.0.exe`** dosyasını çalıştır.

> Program henüz dijital olarak imzalı değil. Windows "Windows kişisel bilgisayarınızı korudu" derse **Ek bilgi → Yine de çalıştır**'a bas.

Kurulum bitince program kendiliğinden açılır.

### 3. Kurulum sihirbazı

İlk açılışta sihirbaz gelir. **Kurulumu başlat**'a bas. Sihirbaz şunları yapar:

1. **Sanal ses kabloları:** VB-CABLE (müşterinin sesi Ece'ye) ve Hi-Fi Cable (Ece'nin sesi telefona) **VB-Audio'nun resmi sitesinden** indirilir, **dijital imzası doğrulanır** ve kurulur.
   - Yönetici izni ve Windows'un "aygıt yazılımı yüklensin mi?" sorusu gelir: **Evet / Yükle**.
   - Hi-Fi Cable penceresinde **Install**.
   - Sürücüler kurulunca **Bilgisayarı yeniden başlat**. Oturum açınca sihirbaz kaldığı yerden devam eder.
2. **Ses ayarları:** Bu kullanıcının varsayılan çıkışı **CABLE Input**, girişi **Hi-Fi Cable Output** olur; arama sırasında ses kısma kapatılır.
3. **Telefon Bağlantısı** açılır: iPhone'u QR ile eşleştir, Aramalar'ı aç. iPhone'da Ayarlar → Bluetooth → bilgisayarın yanındaki (i) → "Sistem Bildirimlerini Paylaş" ve "Kişileri Eşzamanla" açık olsun.

"Sadece kontrol et" hiçbir şeyi değiştirmeden ne yapılacağını gösterir. Sihirbaza sonra da **Araçlar → Kurulum sihirbazı** menüsünden ulaşılır.

> VB-Audio programları kuruluma gömülmedi; dağıtım lisansları buna izin vermiyor. Sihirbaz onları her seferinde resmi siteden indirir. Şirket kullanımı için VB-Audio ücretli lisans öneriyor: https://vb-audio.com/Services/licensing.htm

### 4. İlk arama

Programda Growth OS hesabınla giriş yap → **Arama** → **Ses ayarları**:

| Alan | Seçim |
|---|---|
| Ece müşteriyi nasıl dinlesin | Yapay zekâ doğrudan dinlesin |
| Ece'nin sesi nereye gitsin | **Hi-Fi Cable Input** |
| Müşterinin sesi nereden gelsin | **CABLE Output** |
| Görüşmeyi kulaklığımdan dinle | Açık → kendi kulaklığın |

**Aramaya hazırla** → "Dinliyor" → Telefon Bağlantısı'ndan numarayı çevir → karşı taraf konuşunca Ece başlar.

## Menüler

- **Wexon:** Arama (Ctrl+1), Müşteriler (Ctrl+2), Keşif (Ctrl+3), Mesaj (Ctrl+4), Panel (Ctrl+5)
- **Araçlar:** Kurulum sihirbazı, Telefon Bağlantısı, Windows ses ayarları, Kurulum günlüğü
- Arama ekranı kısayolları: F2 Hazırla · Esc Sustur · F4 Bitir · F8 Sıradaki

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Karşı taraf Ece'yi duymuyor | Ses ayarlarında Ece'nin sesi **Hi-Fi Cable Input** mu? `mmsys.cpl` → Kayıt → **Hi-Fi Cable Output** varsayılan ve varsayılan iletişim aygıtı mı? |
| Ece karşı tarafı duymuyor | Ses ayarlarında müşteri **CABLE Output** mu? Konuşurken seviye çubuğu oynuyor mu? `mmsys.cpl` → Kayıttan Yürütme → **CABLE Input** varsayılan mı? |
| "Growth OS'a ulaşılamadı" | İnternet bağlantısı; gelince program kendiliğinden tekrar dener. |
| Sihirbaz yarıda kaldı | Araçlar → Kurulum sihirbazı → Kurulumu başlat (yapılmış adımları atlar). Günlük: `%LOCALAPPDATA%\WexonGrowthOS\kurulum.log` |

## Geliştirici

```bash
cd masaustu
npm install
node node_modules/electron/install.js   # npm kurulum betiklerini çalıştırmıyorsa Electron'u indirir
npm run yerel                           # yerel test sunucusuna (127.0.0.1:3000) bağlanır
npm run paketle                         # dist/Wexon-Growth-OS-Kurulum-<sürüm>.exe
```

`--adres=<url>` ile bağlanılacak Growth OS adresi değiştirilir (kalıcı kaydedilir); sihirbazın "Ayrıntılar" bölümünden de değiştirilebilir. Tarayıcıdan kullananlar için eski Chrome kısayolu kurulumu: `Wexon-Growth-OS-Kurulum.cmd`.
