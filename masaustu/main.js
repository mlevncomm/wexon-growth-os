// Wexon Growth OS masaüstü programı (Electron).
// Growth OS'u kendi penceresinde açar; ilk açılışta arama bilgisayarını hazırlayan kurulum sihirbazını gösterir.
const { app, BrowserWindow, Menu, shell, session, ipcMain, powerSaveBlocker } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const VARSAYILAN_ADRES = "https://wexon-growth-os.vercel.app";
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
// Paketlenmiş programda kurulum betikleri resources/kurulum altında durur
const kurulumDosyasi = (ad) => (app.isPackaged ? path.join(process.resourcesPath, "kurulum", ad) : path.join(__dirname, ad));

// --adres=http://127.0.0.1:3000 → yerel test sunucusu (kalıcı olarak kaydedilir)
const argAdres = process.argv.find((a) => a.startsWith("--adres="));
if (argAdres) ayarYaz({ adres: argAdres.slice("--adres=".length) });
const kurulumDevam = process.argv.includes("--kurulum-devam");

app.setAppUserModelId("dev.wexon.growthos");
// Ece'nin sesi tıklama beklemeden çalabilsin
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (!app.requestSingleInstanceLock()) app.quit();

let ana = null;
let sihirbaz = null;
let kurulumSureci = null;

app.on("second-instance", () => {
  const w = ana || sihirbaz;
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

function izinleriAyarla() {
  const izinli = new Set(["media", "speaker-selection", "clipboard-sanitized-write", "notifications", "fullscreen"]);
  const ses = session.defaultSession;
  // Mikrofon/hoparlör seçimi sadece Growth OS adresine verilir
  ses.setPermissionRequestHandler((wc, izin, cevap, ayrinti) => cevap(izinli.has(izin) && ayniKaynak(ayrinti.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((wc, izin, kaynak) => izinli.has(izin) && ayniKaynak(kaynak || (wc && wc.getURL()) || ""));
}

// ---------- ana pencere ----------
function anaPencere(sayfa = "/arama") {
  if (ana) { ana.loadURL(adres() + sayfa); ana.focus(); return; }
  const a = ayarOku();
  ana = new BrowserWindow({
    width: a.genislik || 1440,
    height: a.yukseklik || 920,
    minWidth: 1000,
    minHeight: 680,
    title: "Wexon Growth OS",
    icon: IKON,
    backgroundColor: "#f5f7f9",
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      // Telefon Bağlantısı penceresi öndeyken de Ece dinlemeye ve konuşmaya devam etsin
      backgroundThrottling: false,
    },
  });
  if (a.buyuk) ana.maximize();
  ana.once("ready-to-show", () => ana.show());
  ana.loadURL(adres() + sayfa);

  // WhatsApp, harita gibi dış bağlantılar normal tarayıcıda açılır
  ana.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  ana.webContents.on("will-navigate", (e, url) => {
    if (!ayniKaynak(url) && !url.startsWith("file:")) { e.preventDefault(); void shell.openExternal(url); }
  });
  ana.webContents.on("did-fail-load", (_e, kod, aciklama, url, anaCerceve) => {
    if (!anaCerceve || kod === -3) return; // -3: kullanıcı iptal etti
    void ana.loadFile(path.join(__dirname, "hata.html"), { query: { adres: adres() + sayfa, hata: `${aciklama} (${kod})` } });
  });
  ana.on("close", () => {
    const b = ana.getNormalBounds();
    ayarYaz({ genislik: b.width, yukseklik: b.height, buyuk: ana.isMaximized() });
  });
  ana.on("closed", () => { ana = null; });
}

// ---------- kurulum sihirbazı ----------
function sihirbazPencere() {
  if (sihirbaz) { sihirbaz.focus(); return; }
  sihirbaz = new BrowserWindow({
    width: 820,
    height: 760,
    resizable: false,
    maximizable: false,
    title: "Wexon Growth OS — Kurulum",
    icon: IKON,
    backgroundColor: "#f5f7f9",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  });
  sihirbaz.setMenu(null);
  void sihirbaz.loadFile(path.join(__dirname, "sihirbaz.html"));
  sihirbaz.on("closed", () => {
    sihirbaz = null;
    if (!ana) app.quit();
  });
}

function kurulumuCalistir(kontrol) {
  if (kurulumSureci) return Promise.resolve(-1);
  const devam = app.isPackaged
    ? `"${process.execPath}" --kurulum-devam`
    : `"${process.execPath}" "${app.getAppPath()}" --kurulum-devam`;
  const arg = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", kurulumDosyasi("kurulum.ps1"),
    "-Masaustu", "-Adres", adres(), "-DevamKomutu", devam,
  ];
  if (kontrol) arg.push("-Kontrol");
  return new Promise((coz) => {
    kurulumSureci = spawn("powershell.exe", arg, { windowsHide: true });
    let kalan = "";
    const ilet = (veri) => {
      kalan += veri.toString("utf8");
      const satirlar = kalan.split(/\r?\n/);
      kalan = satirlar.pop();
      for (const s of satirlar) sihirbaz?.webContents.send("kurulum:satir", s);
    };
    kurulumSureci.stdout.on("data", ilet);
    kurulumSureci.stderr.on("data", ilet);
    kurulumSureci.on("close", (kod) => {
      if (kalan) sihirbaz?.webContents.send("kurulum:satir", kalan);
      kurulumSureci = null;
      if (kod === 0 && !kontrol) ayarYaz({ kurulumTamam: true });
      coz(kod ?? 1);
    });
    kurulumSureci.on("error", (e) => { sihirbaz?.webContents.send("kurulum:satir", "HATA: " + e.message); kurulumSureci = null; coz(1); });
  });
}

ipcMain.handle("bilgi", () => ({
  adres: adres(),
  surum: app.getVersion(),
  kullanici: process.env.USERNAME || "",
  devam: kurulumDevam,
  kurulumTamam: Boolean(ayarOku().kurulumTamam),
}));
ipcMain.handle("kurulum:baslat", (_e, kontrol) => kurulumuCalistir(Boolean(kontrol)));
ipcMain.handle("adres:kaydet", (_e, yeni) => {
  try {
    const u = new URL(String(yeni));
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    ayarYaz({ adres: u.origin });
    return { ok: true, adres: u.origin };
  } catch { return { ok: false }; }
});
ipcMain.handle("uygulama:ac", () => {
  ayarYaz({ kurulumTamam: true });
  anaPencere();
  sihirbaz?.close();
});
ipcMain.handle("sistem:yenidenBaslat", () => { spawn("shutdown.exe", ["/r", "/t", "5"], { detached: true, windowsHide: true }); });
ipcMain.handle("sistem:telefon", () => telefonBaglantisi());
ipcMain.handle("sistem:ses", () => sesAyarlari());

function telefonBaglantisi() {
  spawn("explorer.exe", ["shell:AppsFolder\\Microsoft.YourPhone_8wekyb3d8bbwe!App"], { detached: true });
}
function sesAyarlari() {
  spawn("control.exe", ["mmsys.cpl"], { detached: true });
}

// ---------- menü ----------
function menuKur() {
  const git = (sayfa) => () => anaPencere(sayfa);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Wexon",
      submenu: [
        { label: "Arama", accelerator: "CmdOrCtrl+1", click: git("/arama") },
        { label: "Müşteriler", accelerator: "CmdOrCtrl+2", click: git("/musteriler") },
        { label: "Keşif", accelerator: "CmdOrCtrl+3", click: git("/ara") },
        { label: "Mesaj", accelerator: "CmdOrCtrl+4", click: git("/whatsapp") },
        { label: "Panel", accelerator: "CmdOrCtrl+5", click: git("/") },
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
        { type: "separator" },
        { label: "Geliştirici araçları", role: "toggleDevTools" },
      ],
    },
    {
      label: "Araçlar",
      submenu: [
        { label: "Kurulum sihirbazı", click: () => sihirbazPencere() },
        { label: "Telefon Bağlantısı", click: telefonBaglantisi },
        { label: "Windows ses ayarları", click: sesAyarlari },
        { type: "separator" },
        { label: "Kurulum günlüğü", click: () => void shell.openPath(path.join(process.env.LOCALAPPDATA || "", "WexonGrowthOS", "kurulum.log")) },
      ],
    },
    {
      label: "Yardım",
      submenu: [
        { label: "Kullanım kılavuzu", click: git("/kilavuz") },
        { label: `Wexon Growth OS ${app.getVersion()}`, enabled: false },
      ],
    },
  ]));
}

app.whenReady().then(() => {
  izinleriAyarla();
  menuKur();
  // Görüşme sürerken Windows programı uyutmasın
  powerSaveBlocker.start("prevent-app-suspension");
  if (!ayarOku().kurulumTamam || kurulumDevam) sihirbazPencere();
  else anaPencere();
});

app.on("window-all-closed", () => app.quit());
