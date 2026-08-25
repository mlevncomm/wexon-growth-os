import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { phoneForWhatsApp } from "../phone";
import { tenantId } from "../tenant";
import { openUtf8, sealUtf8 } from "./seal";

export type WaWebStatus = {
  state: "disconnected" | "starting" | "qr" | "ready" | "error";
  qrDataUrl: string | null;
  error: string | null;
};

type KeyBag = Record<string, unknown>;
type StoredAuth = { creds: unknown; keys: KeyBag };
type WaSocket = {
  ev: {
    on: (event: string, cb: (data: unknown) => void) => void;
    off?: (event: string, cb: (data: unknown) => void) => void;
  };
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
  end: (error: Error | undefined) => Promise<void>;
  logout: (msg?: string) => Promise<void>;
};

type Live = {
  pairId: string;
  sock: WaSocket | null;
  ready: boolean;
};

const PAIR_MS = 240_000;
const g = globalThis as unknown as {
  __wexonWaWeb?: Map<string, Live>;
  __wexonWaWebJobs?: Map<string, Promise<void>>;
};

function lives(): Map<string, Live> {
  if (!g.__wexonWaWeb) g.__wexonWaWeb = new Map();
  return g.__wexonWaWeb;
}

function jobs(): Map<string, Promise<void>> {
  if (!g.__wexonWaWebJobs) g.__wexonWaWebJobs = new Map();
  return g.__wexonWaWebJobs;
}

const silentLogger = {
  level: "silent",
  child() {
    return silentLogger;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function asState(value: string | null | undefined): WaWebStatus["state"] {
  if (value === "starting" || value === "qr" || value === "ready" || value === "error") return value;
  return "disconnected";
}

async function row(owner: string) {
  return prisma.appSettings.findUnique({
    where: { tenantId: owner },
    select: {
      waWebState: true,
      waWebQr: true,
      waWebError: true,
      waWebCreds: true,
      waWebPairId: true,
      waWebPairingUntil: true,
    },
  });
}

async function patch(
  owner: string,
  data: {
    waWebState?: string;
    waWebQr?: string;
    waWebError?: string;
    waWebCreds?: string;
    waWebPairId?: string;
    waWebPairingUntil?: Date | null;
  },
) {
  await prisma.appSettings.upsert({
    where: { tenantId: owner },
    update: data,
    create: { tenantId: owner, ...data },
  });
}

async function stillCurrent(owner: string, pairId: string): Promise<boolean> {
  const current = await row(owner);
  return current?.waWebPairId === pairId;
}

function loadAuth(
  blob: string,
  reviver: (k: string, v: unknown) => unknown,
): StoredAuth | null {
  const json = openUtf8(blob);
  if (!json) return null;
  try {
    return JSON.parse(json, reviver as (k: string, v: unknown) => unknown) as StoredAuth;
  } catch {
    return null;
  }
}

async function persistAuth(
  owner: string,
  auth: StoredAuth,
  replacer: (k: string, v: unknown) => unknown,
) {
  await patch(owner, { waWebCreds: sealUtf8(JSON.stringify(auth, replacer)) });
}

async function loadBaileys() {
  return import("@whiskeysockets/baileys");
}

function boomCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const output = (err as { output?: { statusCode?: number } }).output;
  return output?.statusCode;
}

function friendlyDisconnect(code: number | undefined, fallback: string): string {
  if (code === 401) return "WhatsApp oturumu telefon tarafından kapatıldı. QR’ı tekrar okutun.";
  if (code === 403) return "WhatsApp bu sunucudan bağlantıyı reddetti. Birkaç dakika sonra tekrar deneyin.";
  if (code === 440) return "Aynı numara başka bir oturumda açıldı.";
  if (code === 408) return "QR süresi doldu. Yeniden açın.";
  return fallback;
}

export async function getWebStatus(owner = tenantId()): Promise<WaWebStatus> {
  const current = await row(owner);
  if (!current) return { state: "disconnected", qrDataUrl: null, error: null };

  const expired =
    (current.waWebState === "starting" || current.waWebState === "qr") &&
    current.waWebPairingUntil &&
    current.waWebPairingUntil.getTime() < Date.now();
  if (expired) {
    await patch(owner, {
      waWebState: "error",
      waWebQr: "",
      waWebError: "QR süresi doldu. Yeniden açın.",
      waWebPairingUntil: null,
    });
    return { state: "error", qrDataUrl: null, error: "QR süresi doldu. Yeniden açın." };
  }

  if (current.waWebState === "ready" && !current.waWebCreds) {
    return { state: "disconnected", qrDataUrl: null, error: null };
  }

  return {
    state: asState(current.waWebState),
    qrDataUrl: current.waWebQr || null,
    error: current.waWebError || null,
  };
}

export async function webReady(owner = tenantId()): Promise<boolean> {
  const current = await row(owner);
  return Boolean(current?.waWebCreds) && current?.waWebState === "ready";
}

async function quietEnd(owner: string) {
  const live = lives().get(owner);
  lives().delete(owner);
  if (!live?.sock) return;
  try {
    await live.sock.end(undefined);
  } catch {
    /* ignore */
  }
}

async function makeAuthState(
  owner: string,
  baileys: Awaited<ReturnType<typeof loadBaileys>>,
  existing: StoredAuth | null,
) {
  const creds = existing?.creds ? existing.creds : baileys.initAuthCreds();
  const keys: KeyBag = { ...(existing?.keys ?? {}) };
  const auth: StoredAuth = { creds, keys };
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => persistAuth(owner, auth, baileys.BufferJSON.replacer);

  const schedule = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 250);
  };

  return {
    auth,
    flush,
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, unknown> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = keys[`${type}-${id}`];
              if (type === "app-state-sync-key" && value) {
                value = baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data: Record<string, Record<string, unknown | null | undefined>>) => {
          for (const category of Object.keys(data)) {
            const entries = data[category] ?? {};
            for (const id of Object.keys(entries)) {
              const value = entries[id];
              const key = `${category}-${id}`;
              if (value == null) delete keys[key];
              else keys[key] = value;
            }
          }
          schedule();
        },
      },
    },
    saveCreds: async () => {
      auth.creds = creds;
      schedule();
      await flush();
    },
  };
}

async function openSocket(
  owner: string,
  pairId: string,
  existing: StoredAuth | null,
  mode: "pair" | "send",
): Promise<{ sock: WaSocket; untilReady: Promise<void> }> {
  const baileys = await loadBaileys();
  const fetched = await baileys.fetchLatestBaileysVersion().catch(() => ({ version: undefined as [number, number, number] | undefined }));
  const authState = await makeAuthState(owner, baileys, existing);
  const sock = baileys.makeWASocket({
    auth: authState.state as never,
    ...(fetched.version ? { version: fetched.version } : {}),
    logger: silentLogger as never,
    browser: baileys.Browsers.appropriate("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    qrTimeout: 60_000,
  }) as unknown as WaSocket;

  lives().set(owner, { pairId, sock, ready: false });

  const untilReady = new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, err?: string) => {
      if (settled) return;
      settled = true;
      if (ok) resolve();
      else reject(new Error(err || "WhatsApp bağlanamadı"));
    };

    sock.ev.on("creds.update", () => {
      void authState.saveCreds().catch(() => undefined);
    });

    sock.ev.on("connection.update", (update) => {
      void (async () => {
        if (!(await stillCurrent(owner, pairId))) return;
        const info = update as {
          connection?: string;
          qr?: string;
          lastDisconnect?: { error?: unknown };
        };
        if (info.qr && mode === "pair") {
          const qrcode = await import("qrcode");
          const qrDataUrl = await qrcode.toDataURL(info.qr);
          if (!(await stillCurrent(owner, pairId))) return;
          await patch(owner, {
            waWebState: "qr",
            waWebQr: qrDataUrl,
            waWebError: "",
          });
        }
        if (info.connection === "open") {
          lives().set(owner, { pairId, sock, ready: true });
          await authState.flush();
          await patch(owner, {
            waWebState: "ready",
            waWebQr: "",
            waWebError: "",
            waWebPairingUntil: null,
          });
          finish(true);
        }
        if (info.connection === "close") {
          const code = boomCode(info.lastDisconnect?.error);
          lives().delete(owner);
          if (code === baileys.DisconnectReason.loggedOut || code === 401) {
            await patch(owner, {
              waWebState: "disconnected",
              waWebQr: "",
              waWebError: "",
              waWebCreds: "",
              waWebPairId: "",
              waWebPairingUntil: null,
            });
            finish(false, friendlyDisconnect(code, "Oturum kapandı"));
            return;
          }
          if (mode === "send") {
            finish(false, friendlyDisconnect(code, "WhatsApp yeniden bağlanamadı."));
            return;
          }
          const liveState = await row(owner);
          if (liveState?.waWebState === "ready" && liveState.waWebCreds) {
            finish(true);
            return;
          }
          const message = friendlyDisconnect(code, "WhatsApp bağlantısı koptu. QR’ı tekrar açın.");
          await patch(owner, {
            waWebState: "error",
            waWebQr: "",
            waWebError: message,
            waWebPairingUntil: null,
          });
          finish(false, message);
        }
      })().catch(() => undefined);
    });
  });

  return { sock, untilReady };
}

async function runPairing(owner: string): Promise<void> {
  const pairId = randomUUID();
  await quietEnd(owner);
  await patch(owner, {
    waWebPairId: pairId,
    waWebState: "starting",
    waWebQr: "",
    waWebError: "",
    waWebCreds: "",
    waWebPairingUntil: new Date(Date.now() + PAIR_MS),
  });

  const { untilReady } = await openSocket(owner, pairId, null, "pair");
  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("QR süresi doldu. Yeniden açın.")), PAIR_MS);
  });
  try {
    await Promise.race([untilReady, timeout]);
  } catch (err) {
    if (!(await stillCurrent(owner, pairId))) return;
    const message = err instanceof Error ? err.message : "WhatsApp bağlanamadı";
    const current = await row(owner);
    if (current?.waWebState === "ready") return;
    await quietEnd(owner);
    await patch(owner, {
      waWebState: "error",
      waWebQr: "",
      waWebError: message,
      waWebPairingUntil: null,
    });
  }
}

export function beginWebPairing(owner = tenantId()): Promise<void> {
  const job = runPairing(owner).finally(() => {
    if (jobs().get(owner) === job) jobs().delete(owner);
  });
  jobs().set(owner, job);
  return job;
}

export async function waitForQr(owner = tenantId(), ms = 25_000): Promise<WaWebStatus> {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const status = await getWebStatus(owner);
    if (status.state === "qr" || status.state === "ready" || status.state === "error") return status;
    await new Promise((r) => setTimeout(r, 800));
  }
  return getWebStatus(owner);
}

export async function destroyWebSession(owner = tenantId()): Promise<void> {
  const live = lives().get(owner);
  try {
    await live?.sock?.logout("Kes");
  } catch {
    await quietEnd(owner);
  }
  lives().delete(owner);
  jobs().delete(owner);
  await patch(owner, {
    waWebState: "disconnected",
    waWebQr: "",
    waWebError: "",
    waWebCreds: "",
    waWebPairId: "",
    waWebPairingUntil: null,
  });
}

async function socketForSend(owner: string): Promise<WaSocket> {
  const live = lives().get(owner);
  if (live?.sock && live.ready) return live.sock;
  const current = await row(owner);
  const baileys = await loadBaileys();
  const stored = current?.waWebCreds ? loadAuth(current.waWebCreds, baileys.BufferJSON.reviver) : null;
  if (!stored) throw new Error("WhatsApp bağlı değil. Mesaj ekranında QR’ı okutun.");
  const pairId = current?.waWebPairId || randomUUID();
  const { sock, untilReady } = await openSocket(owner, pairId, stored, "send");
  await Promise.race([
    untilReady,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("WhatsApp yeniden bağlanamadı.")), 45_000)),
  ]);
  return sock;
}

export async function sendWebMessage(e164: string, text: string, owner = tenantId()): Promise<void> {
  const sock = await socketForSend(owner);
  const jid = `${phoneForWhatsApp(e164)}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  await new Promise((r) => setTimeout(r, 700));
}
