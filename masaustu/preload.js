// Kurulum sihirbazının ana süreçle konuştuğu dar köprü.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wexon", {
  bilgi: () => ipcRenderer.invoke("bilgi"),
  kurulum: (kontrol) => ipcRenderer.invoke("kurulum:baslat", Boolean(kontrol)),
  satirGelince: (cb) => ipcRenderer.on("kurulum:satir", (_e, s) => cb(String(s))),
  uygulamayiAc: () => ipcRenderer.invoke("uygulama:ac"),
  yenidenBaslat: () => ipcRenderer.invoke("sistem:yenidenBaslat"),
  telefon: () => ipcRenderer.invoke("sistem:telefon"),
  sesAyarlari: () => ipcRenderer.invoke("sistem:ses"),
  adresKaydet: (a) => ipcRenderer.invoke("adres:kaydet", String(a)),
});
