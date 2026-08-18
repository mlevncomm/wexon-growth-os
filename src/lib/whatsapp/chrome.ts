import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WINDOWS_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  path.join(os.homedir(), "AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function findChromeExecutable(): string | null {
  if (process.env.VERCEL === "1") return null;
  for (const candidate of WINDOWS_CHROME) {
    if (!candidate) continue;
    if (fs.existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
  }
  return null;
}

export function chromeMissingMessage(): string {
  return "Bu makinede Chrome veya Edge bulunamadı. Google Chrome kurun, sonra QR oturumunu tekrar açın.";
}

export function isTransientWaError(raw: string): boolean {
  return /Execution context was destroyed|Target closed|Session closed|Protocol error|reading 'Socket'|WAWebSocketModel|Evaluation failed/i.test(
    raw,
  );
}

export function friendlyWaError(raw: string): string {
  if (/Could not find Chrome/i.test(raw) || /Failed to launch/i.test(raw)) {
    return chromeMissingMessage();
  }
  if (/zaman aşımı|profili açılmadı|veritabanı/i.test(raw)) {
    return raw;
  }
  if (/reading 'Socket'|WAWebSocketModel/i.test(raw)) {
    return "WhatsApp Web tam yüklenmedi. Pembe hatalı Chrome penceresini kapatın, Kes’e basın, QR’ı tekrar açın.";
  }
  if (isTransientWaError(raw)) {
    return "WhatsApp tarayıcı oturumu koptu. QR oturumunu tekrar açın.";
  }
  return raw;
}

type WaClientCtor = {
  __wexonPatched?: boolean;
  prototype: {
    inject: (...args: unknown[]) => Promise<unknown>;
    pupPage?: {
      __wexonEvalPatched?: boolean;
      evaluate: (...args: unknown[]) => Promise<unknown>;
    };
  };
};

/** WhatsApp Web SPA yenilenince Puppeteer "Execution context was destroyed" atar; evaluate'i tekrar dener. */
export function patchWhatsAppClient(Client: WaClientCtor): void {
  if (Client.__wexonPatched) return;
  Client.__wexonPatched = true;
  const origInject = Client.prototype.inject;
  Client.prototype.inject = async function patchedInject(this: WaClientCtor["prototype"], ...args: unknown[]) {
    const page = this.pupPage;
    if (page && !page.__wexonEvalPatched) {
      page.__wexonEvalPatched = true;
      const orig = page.evaluate.bind(page);
      page.evaluate = async (...evalArgs: unknown[]) => {
        let last: unknown;
        for (let i = 0; i < 8; i += 1) {
          try {
            return await orig(...evalArgs);
          } catch (err) {
            last = err;
            const msg = err instanceof Error ? err.message : String(err);
            if (!isTransientWaError(msg)) throw err;
            await new Promise((r) => setTimeout(r, 200));
          }
        }
        throw last;
      };
    }
    return origInject.apply(this, args);
  };
}
