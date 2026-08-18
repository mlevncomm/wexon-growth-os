import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { phoneForWhatsApp } from "../phone";
import {
  chromeMissingMessage,
  findChromeExecutable,
  friendlyWaError,
  patchWhatsAppClient,
} from "./chrome";

export type LocalWaStatus = {
  state: "disconnected" | "starting" | "qr" | "ready" | "error";
  qrDataUrl: string | null;
  error: string | null;
};

type WaClient = import("whatsapp-web.js").Client;

type WaBundle = {
  status: LocalWaStatus;
  client: WaClient | null;
  starting: Promise<void> | null;
  gen: number;
};

/** Chrome IndexedDB, proje yolundaki Türkçe/boşluk karakterlerinde bozuluyor. */
export const AUTH_DIR = path.join(os.homedir(), "AppData", "Local", "Wexon", "wa-session");
const g = globalThis as unknown as { __gooleadsWa?: WaBundle };

function bundle(): WaBundle {
  if (!g.__gooleadsWa) {
    g.__gooleadsWa = {
      status: { state: "disconnected", qrDataUrl: null, error: null },
      client: null,
      starting: null,
      gen: 0,
    };
  }
  return g.__gooleadsWa;
}

export function getLocalStatus(): LocalWaStatus {
  const s = bundle().status;
  if (!s.error) return s;
  return { ...s, error: friendlyWaError(s.error) };
}

async function quietDestroy(client: WaClient | null): Promise<void> {
  if (!client) return;
  const raw = client as WaClient & {
    pupBrowser?: { isConnected?: () => boolean; close: () => Promise<void> };
  };
  try {
    if (raw.pupBrowser?.isConnected?.()) await raw.pupBrowser.close();
  } catch {
    /* ignore */
  }
  try {
    await client.destroy();
  } catch {
    /* ignore */
  }
}

async function resetAuthDir(): Promise<void> {
  await rm(AUTH_DIR, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 }).catch(() => {
    /* kilitli dosya sonraki denemede gider */
  });
  await mkdir(AUTH_DIR, { recursive: true });
}

function hideWebdriver() {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
}

function puppeteerOpts(executablePath: string) {
  return {
    headless: false,
    executablePath,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    protocolTimeout: 180_000,
    timeout: 0,
    defaultViewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=480,720",
    ],
  };
}

export async function startLocalSession(): Promise<LocalWaStatus> {
  const b = bundle();
  if (b.status.state === "ready") return getLocalStatus();
  if (b.starting) {
    await Promise.race([b.starting, new Promise((r) => setTimeout(r, 8000))]);
    return getLocalStatus();
  }

  const gen = b.gen + 1;
  b.gen = gen;

  b.starting = (async () => {
    await quietDestroy(b.client);
    b.client = null;
    await resetAuthDir();

    const executablePath = findChromeExecutable();
    if (!executablePath) {
      b.status = { state: "error", qrDataUrl: null, error: chromeMissingMessage() };
      return;
    }

    b.status = { state: "starting", qrDataUrl: null, error: null };
    const { Client, LocalAuth } = await import("whatsapp-web.js");
    patchWhatsAppClient(Client as unknown as Parameters<typeof patchWhatsAppClient>[0]);
    const qrcode = await import("qrcode");

    const launch = async () => {
      const client = new Client({
        authStrategy: new LocalAuth({
          dataPath: AUTH_DIR,
          clientId: "wexon",
        }),
        authTimeoutMs: 90_000,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        qrMaxRetries: 0,
        deviceName: "Wexon",
        evalOnNewDoc: hideWebdriver,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.138 Safari/537.36",
        puppeteer: puppeteerOpts(executablePath),
      });

      client.on("qr", async (qr: string) => {
        if (b.gen !== gen) return;
        b.status = {
          state: "qr",
          qrDataUrl: await qrcode.toDataURL(qr),
          error: null,
        };
      });

      client.on("ready", () => {
        if (b.gen !== gen) return;
        b.status = { state: "ready", qrDataUrl: null, error: null };
      });

      client.on("authenticated", () => {
        if (b.gen !== gen) return;
        if (b.status.state !== "ready") b.status = { ...b.status, error: null };
      });

      client.on("auth_failure", (msg: string) => {
        if (b.gen !== gen) return;
        b.status = {
          state: "error",
          qrDataUrl: null,
          error: msg || "WhatsApp oturumu doğrulanamadı",
        };
      });

      client.on("disconnected", () => {
        if (b.gen !== gen) return;
        b.client = null;
        b.status = { state: "disconnected", qrDataUrl: null, error: null };
      });

      b.client = client;
      let bootTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.initialize(),
          new Promise<never>((_, reject) => {
            bootTimer = setTimeout(
              () =>
                reject(
                  new Error(
                    "WhatsApp tarayıcı profili açılmadı. Kes’e basın, pembe hatalı Chrome penceresini kapatın, sonra QR’ı tekrar açın.",
                  ),
                ),
              75_000,
            );
          }),
        ]);
      } finally {
        if (bootTimer) clearTimeout(bootTimer);
      }
    };

    for (let i = 0; i < 2; i += 1) {
      if (b.gen !== gen) return;
      try {
        await launch();
        return;
      } catch (err) {
        if (b.gen !== gen) return;
        const raw = err instanceof Error ? err.message : String(err);
        await quietDestroy(b.client);
        b.client = null;
        if (b.status.state === "qr" || b.status.state === "ready") return;
        if (i === 0) {
          await resetAuthDir();
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        b.status = {
          state: "error",
          qrDataUrl: null,
          error: friendlyWaError(raw),
        };
        return;
      }
    }
  })().finally(() => {
    if (b.gen === gen) b.starting = null;
  });

  await Promise.race([
    b.starting,
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
  return getLocalStatus();
}

export async function sendLocalMessage(e164: string, text: string): Promise<void> {
  const b = bundle();
  if (!b.client || b.status.state !== "ready") {
    throw new Error("WhatsApp Web oturumu hazır değil. QR kodunu okutun.");
  }
  const chatId = `${phoneForWhatsApp(e164)}@c.us`;
  await b.client.sendMessage(chatId, text);
}

export async function destroyLocalSession(): Promise<void> {
  const b = bundle();
  b.gen += 1;
  const client = b.client;
  b.client = null;
  b.starting = null;
  b.status = { state: "disconnected", qrDataUrl: null, error: null };
  await quietDestroy(client);
}
