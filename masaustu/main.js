// Wexon Growth OS masaüstü programı (Electron).
// Müşteri bulma ve WhatsApp'tan mesaj gönderme ekranlarını kendi penceresinde açar; yeni sürüm çıkınca "Güncelle" sorar.
const { app, BrowserWindow, Menu, shell, session, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const VARSAYILAN_ADRES = "https://wexon-growth-os.vercel.app";
// Her açılışta önce profil (Wexon.dev / Aquails) ve profil şifresi istenir
const ILK_SAYFA = "/profil";
const IKON = path.join(__dirname, "build", "icon.ico");

// ---------- ayarlar (kullanıcı klasöründe) ----------
const ayarDosyasi = () => path.join(app.getPath("userData"), "ayarlar.json");
function ayarOku() {
  try { return JSON.parse(fs.readFileSync(ayarDosyasi(), "utf8")); } catch { return {}; }
}
function ayarYaz(yama) {
  const a = { ...ayarOku(), ...yama };
  fs.mkdirSync(path.dirname(ayarDosyasi()), { recursive: true });
  fs.writeFileSync(ayarDosyasi(), JSON.stringify(a, null, 2));
  return a;
}
const adres = () => String(ayarOku().adres || VARSAYILAN_ADRES).replace(/\/+$/, "");
const ayniKaynak = (url) => { try { return new URL(url).origin === new URL(adres()).origin; } catch { return false; } };

// --adres=http://127.0.0.1:3000 → yerel test sunucusu (kalıcı olarak kaydedilir)
const argAdres = process.argv.find((a) => a.startsWith("--adres="));
if (argAdres) ayarYaz({ adres: argAdres.slice("--adres=".length) });

app.setAppUserModelId("dev.wexon.growthos");
if (!app.requestSingleInstanceLock()) app.quit();

let ana = null;

app.on("second-instance", () => {
  if (ana) { if (ana.isMinimized()) ana.restore(); ana.focus(); }
});

function izinleriAyarla() {
  const izinli = new Set(["clipboard-sanitized-write", "notifications", "fullscreen"]);
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, izin, cevap, ayrinti) => cevap(izinli.has(izin) && ayniKaynak(ayrinti.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((wc, izin, kaynak) => izinli.has(izin) && ayniKaynak(kaynak || (wc && wc.getURL()) || ""));
}

// ---------- pencere ----------
function anaPencere(sayfa = ILK_SAYFA) {
  if (ana) { void ana.loadURL(adres() + sayfa); ana.focus(); return; }
  const a = ayarOku();
  ana = new BrowserWindow({
    width: a.genislik || 1440,
    height: a.yukseklik || 920,
    minWidth: 1000,
    minHeight: 680,
    title: "Wexon Growth OS",
    icon: IKON,
    backgroundColor: "#05090b",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });
  if (a.buyuk) ana.maximize();
  ana.once("ready-to-show", () => ana.show());
  // Önce yerel açılış ekranı anında görünür; uygulama sayfası hazır olunca yerini alır
  // (en az 0,8 sn görünür ki ekran yanıp sönmesin)
  const acilis = ana.loadFile(path.join(__dirname, "acilis.html")).catch(() => undefined);
  void Promise.all([acilis, new Promise((r) => setTimeout(r, 800))]).then(() => {
    if (ana && !ana.isDestroyed()) void ana.loadURL(adres() + sayfa);
  });

  // WhatsApp, harita gibi dış bağlantılar bilgisayardaki uygulamada / tarayıcıda açılır
  ana.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  ana.webContents.on("will-navigate", (e, url) => {
    if (!ayniKaynak(url) && !url.startsWith("file:")) { e.preventDefault(); void shell.openExternal(url); }
  });
  ana.webContents.on("did-fail-load", (_e, kod, aciklama, _url, anaCerceve) => {
    if (!anaCerceve || kod === -3) return; // -3: kullanıcı iptal etti
    void ana.loadFile(path.join(__dirname, "hata.html"), { query: { adres: adres() + sayfa, hata: `${aciklama} (${kod})` } });
  });
  ana.on("close", () => {
    const b = ana.getNormalBounds();
    ayarYaz({ genislik: b.width, yukseklik: b.height, buyuk: ana.isMaximized() });
  });
  ana.on("closed", () => { ana = null; });
}

// ---------- program güncellemesi (GitHub'daki en son sürüm) ----------
let guncelleyici = null;
let bekleyenSurum = null;
let elleDenetim = false;
let soruAcik = false;

// Yeni sürüm indirilince her seferinde sor: "Güncelle" ya da "Sonra" (kapanırken kurulur)
async function guncellemeyiSor() {
  if (!bekleyenSurum || soruAcik) return;
  soruAcik = true;
  const { response } = await dialog.showMessageBox(ana || undefined, {
    type: "info",
    title: "Yeni sürüm var",
    message: `Wexon Growth OS ${bekleyenSurum} hazır.`,
    detail: "Güncelle'ye basınca program birkaç saniye içinde yeni sürümle yeniden açılır.",
    buttons: ["Güncelle", "Sonra"],
    defaultId: 0,
    cancelId: 1,
  });
  soruAcik = false;
  if (response === 0) guncelleyici.quitAndInstall(true, true);
  else setTimeout(guncellemeyiSor, 60 * 60_000); // bir saat sonra tekrar hatırlat; kapanırken zaten kurulur
}

function guncellemeyiKur() {
  if (!app.isPackaged) return; // geliştirme sırasında güncelleme yok
  try { ({ autoUpdater: guncelleyici } = require("electron-updater")); } catch { return; }
  guncelleyici.autoDownload = true;
  guncelleyici.autoInstallOnAppQuit = true;
  guncelleyici.on("update-downloaded", (bilgi) => { bekleyenSurum = bilgi.version; void guncellemeyiSor(); });
  guncelleyici.on("update-not-available", () => {
    if (elleDenetim) { elleDenetim = false; void dialog.showMessageBox({ type: "info", title: "Güncel", message: `Wexon Growth OS güncel (${app.getVersion()}).` }); }
  });
  guncelleyici.on("error", (e) => {
    if (elleDenetim) { elleDenetim = false; void dialog.showMessageBox({ type: "warning", title: "Güncelleme denetlenemedi", message: "Güncelleme sunucusuna ulaşılamadı.", detail: String((e && e.message) || e).slice(0, 300) }); }
  });
  const denetle = () => guncelleyici.checkForUpdates().catch(() => undefined);
  setTimeout(denetle, 10_000);
  setInterval(denetle, 60 * 60_000); // saatte bir bak
}

function guncellemeleriDenetle() {
  if (!guncelleyici) {
    void dialog.showMessageBox({ type: "info", title: "Güncelleme", message: "Güncelleme sadece kurulu programda çalışır." });
    return;
  }
  if (bekleyenSurum) { void guncellemeyiSor(); return; }
  elleDenetim = true;
  guncelleyici.checkForUpdates().catch(() => undefined);
}

// 1.0.0 "tüm kullanıcılar" kurulumundan kalan kopyayı bir kez kaldırır (yönetici izni bir kez istenir)
function eskiKurulumuTemizle() {
  if (!app.isPackaged || ayarOku().eskiKurulumTemizlendi) return;
  const eski = path.join(process.env.ProgramFiles || "C:\\Program Files", "Wexon Growth OS", "Uninstall Wexon Growth OS.exe");
  if (!fs.existsSync(eski) || process.execPath.startsWith(path.dirname(eski))) { ayarYaz({ eskiKurulumTemizlendi: true }); return; }
  const ps = `Start-Process -FilePath '${eski.replace(/'/g, "''")}' -ArgumentList '/allusers','/S' -Verb RunAs -Wait`;
  const p = spawn("powershell.exe", ["-NoProfile", "-Command", ps], { windowsHide: true });
  p.on("close", () => { if (!fs.existsSync(eski)) ayarYaz({ eskiKurulumTemizlendi: true }); });
}

// ---------- menü ----------
function menuKur() {
  const git = (sayfa) => () => anaPencere(sayfa);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Wexon",
      submenu: [
        { label: "Müşteri Bul", accelerator: "CmdOrCtrl+1", click: git("/ara") },
        { label: "Müşteriler", accelerator: "CmdOrCtrl+2", click: git("/musteriler") },
        { label: "Mesaj", accelerator: "CmdOrCtrl+3", click: git("/whatsapp") },
        { label: "Ayarlar", accelerator: "CmdOrCtrl+4", click: git("/ayarlar") },
        { type: "separator" },
        { label: "Profil değiştir", accelerator: "CmdOrCtrl+P", click: git("/profil") },
        { type: "separator" },
        { label: "Çıkış", role: "quit" },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        { label: "Yenile", role: "reload" },
        { label: "Tam ekran", role: "togglefullscreen" },
        { type: "separator" },
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Normal boyut", role: "resetZoom" },
      ],
    },
    {
      label: "Yardım",
      submenu: [
        { label: "Güncellemeleri denetle", click: guncellemeleriDenetle },
        { label: `Wexon Growth OS ${app.getVersion()}`, enabled: false },
      ],
    },
  ]));
}

// Önceki açılıştan kalan profil çerezi silinir; profil seçimi her açılışta yeniden yapılır
async function profiliKapat() {
  try {
    const ses = session.defaultSession;
    const cerezler = await ses.cookies.get({ name: "wexon_profil" });
    await Promise.all(cerezler.map((c) => ses.cookies.remove(`http${c.secure ? "s" : ""}://${c.domain.replace(/^\./, "")}${c.path}`, c.name)));
  } catch {}
}

app.whenReady().then(async () => {
  izinleriAyarla();
  menuKur();
  await profiliKapat();
  anaPencere();
  guncellemeyiKur();
  setTimeout(eskiKurulumuTemizle, 5000);
});

app.on("window-all-closed", () => app.quit());
