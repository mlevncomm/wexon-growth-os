// build/icon.ico üretir: teal daire üzerinde nane yeşili "W" (16–256 px, PNG gömülü ICO).
// Windows'un kendi çizim kütüphanesini (System.Drawing) PowerShell üzerinden kullanır.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const boyutlar = [256, 128, 64, 48, 32, 16];
const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "wexon-simge-"));
const ps = `
Add-Type -AssemblyName System.Drawing
foreach ($s in @(${boyutlar.join(",")})) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  $p = [Math]::Max(1, [int]($s * 0.03))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11, 79, 74))), $p, $p, $s - 2 * $p, $s - 2 * $p)
  $font = New-Object System.Drawing.Font 'Segoe UI', ([single]($s * 0.5)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('W', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(61, 255, 154))), (New-Object System.Drawing.RectangleF 0, ([single]($s * 0.03)), $s, $s), $fmt)
  $bmp.Save((Join-Path '${gecici.replace(/\\/g, "\\\\")}' "$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}`;
execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "inherit" });

// ICO dosyası: başlık + dizin + PNG verileri
const pngler = boyutlar.map((s) => fs.readFileSync(path.join(gecici, `${s}.png`)));
const baslik = Buffer.alloc(6);
baslik.writeUInt16LE(0, 0); baslik.writeUInt16LE(1, 2); baslik.writeUInt16LE(pngler.length, 4);
const dizin = Buffer.alloc(16 * pngler.length);
let konum = 6 + dizin.length;
pngler.forEach((png, i) => {
  const s = boyutlar[i];
  dizin.writeUInt8(s >= 256 ? 0 : s, i * 16);
  dizin.writeUInt8(s >= 256 ? 0 : s, i * 16 + 1);
  dizin.writeUInt16LE(1, i * 16 + 4);
  dizin.writeUInt16LE(32, i * 16 + 6);
  dizin.writeUInt32LE(png.length, i * 16 + 8);
  dizin.writeUInt32LE(konum, i * 16 + 12);
  konum += png.length;
});
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync(path.join("build", "icon.ico"), Buffer.concat([baslik, dizin, ...pngler]));
fs.copyFileSync(path.join(gecici, "256.png"), path.join("build", "icon.png"));
fs.rmSync(gecici, { recursive: true, force: true });
console.log("build/icon.ico hazır");
