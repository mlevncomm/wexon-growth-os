# Wexon Growth OS — Masaüstü Programı

Sade bir müşteri bulma ve iletişim programı:

1. **Müşteri Bul** — Google Haritalar'dan sitesi olmayan işletmeleri bulur.
2. **Müşteriler** — bulunan işletmeler. Her satırda **WhatsApp'tan yaz**: hazır mesajı seç ("Web sitesi tasarladım", "Tanıtım", "Takip"), istersen tasarım linkini ekle, düzelt, **WhatsApp'ta aç**. Göndermek ve konuşmak sende; müşteri "Yazıldı" olarak işaretlenir.
3. **Mesaj** — kendi mesaj şablonların ve toplu gönderim.
4. **Ayarlar** — Google Places anahtarı, WhatsApp bağlantısı.

## Kurulum

`Wexon-Growth-OS-Kurulum-<sürüm>.exe` dosyasını çalıştır. Tek tıkla kurulur, yönetici izni istemez.
Program imzalı olmadığı için Windows uyarı verirse **Ek bilgi → Yine de çalıştır**.

## Güncelleme

- Program saatte bir yeni sürüm var mı bakar, varsa arka planda indirir ve **"Yeni sürüm var · Güncelle"** diye sorar. "Sonra" dersen program kapanırken kurulur.
- Ekranlarda yapılan değişiklikler için köşede **"Yeni sürüm var · Güncelle"** uyarısı çıkar.
- Elle: **Yardım → Güncellemeleri denetle**.

## Geliştirici

```bash
cd masaustu
npm install
node node_modules/electron/install.js   # npm kurulum betiklerini çalıştırmıyorsa
npm run yerel                           # yerel test sunucusu (127.0.0.1:3000)
npm run paketle                         # dist/Wexon-Growth-OS-Kurulum-<sürüm>.exe
```

Yeni sürüm yayınlamak: `package.json` sürümünü artır → `npm run paketle` → GitHub'da `v<sürüm>` release'ine `dist` içindeki `.exe`, `.exe.blockmap` ve `latest.yml` dosyalarını yükle.
