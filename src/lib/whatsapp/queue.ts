import { composePitch, AUTO_TEMPLATE_ID, AUTO_TEMPLATE_MARKER } from "../pitch";
import { prisma } from "../prisma";
import { isServerless } from "../platform";
import { getSettings, updateSettings } from "../settings";
import { currentTenant, tenantId } from "../tenant";
import type { Vertical } from "../verticals";
import { cloudConfigured, sendCloudMessage } from "./cloud";

type QueueGlobal = {
  running: boolean;
  loop: Promise<void> | null;
};

const g = globalThis as unknown as { __gooleadsQueue?: QueueGlobal };

function state(): QueueGlobal {
  if (!g.__gooleadsQueue) {
    g.__gooleadsQueue = { running: false, loop: null };
  }
  return g.__gooleadsQueue;
}

function todayStart(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return new Date(`${y}-${m}-${d}T00:00:00+03:00`);
}

function tid(): string {
  return tenantId();
}

export async function sentTodayCount(): Promise<number> {
  return prisma.outreachJob.count({
    where: { tenantId: tid(), status: "sent", sentAt: { gte: todayStart() } },
  });
}

function jitter(minSec: number, maxSec: number): number {
  const lo = Math.max(8, Math.min(minSec, maxSec));
  const hi = Math.max(lo, maxSec);
  return lo + Math.random() * (hi - lo);
}

async function sendMessage(phone: string, text: string): Promise<"cloud" | "local"> {
  if (await cloudConfigured()) {
    await sendCloudMessage(phone, text);
    return "cloud";
  }
  const { sendWebMessage, webReady } = await import("./web");
  if (!(await webReady())) {
    throw new Error("WhatsApp bağlı değil. Mesaj ekranında QR’ı okutun.");
  }
  await sendWebMessage(phone, text);
  return "local";
}

async function tick(): Promise<"idle" | "sent" | "wait" | "paused" | "capped"> {
  const owner = tid();
  const settings = await getSettings();
  if (settings.queueStopped) return "paused";
  if (settings.queuePaused) return "paused";

  const sent = await sentTodayCount();
  if (sent >= settings.dailyCap) {
    await updateSettings({ queuePaused: true });
    return "capped";
  }

  const job = await prisma.outreachJob.findFirst({
    where: {
      tenantId: owner,
      status: "queued",
      channel: "whatsapp",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    include: { lead: true },
  });
  if (!job) return "idle";

  if (!job.lead.phone) {
    await prisma.outreachJob.update({
      where: { id: job.id },
      data: { status: "skipped", error: "Telefon yok" },
    });
    return "sent";
  }

  if (job.lead.status === "yazildi" || job.lead.status === "ilgilenmiyor") {
    await prisma.outreachJob.update({
      where: { id: job.id },
      data: { status: "skipped", error: "Bu müşteri zaten işlendi" },
    });
    return "sent";
  }

  await prisma.outreachJob.update({
    where: { id: job.id },
    data: { status: "sending" },
  });

  try {
    await sendMessage(job.lead.phone, job.message);
    await prisma.outreachJob.update({
      where: { id: job.id },
      data: { status: "sent", sentAt: new Date(), error: null },
    });
    await prisma.lead.update({
      where: { id: job.leadId },
      data: { status: "yazildi" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gönderilemedi";
    const retryable = message.includes("bağlı değil") || message.includes("hazır değil");
    await prisma.outreachJob.update({
      where: { id: job.id },
      data: retryable
        ? { status: "queued", error: message }
        : { status: "failed", error: message },
    });
    if (retryable) return "wait";
  }

  const delayMs = jitter(settings.delayMinSec, settings.delayMaxSec) * 1000;
  if (!isServerless()) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return "sent";
}

async function loop(): Promise<void> {
  const s = state();
  s.running = true;
  try {
    while (true) {
      const settings = await getSettings();
      if (settings.queueStopped) break;
      const result = await tick();
      if (result === "idle" || result === "paused" || result === "capped") {
        await new Promise((r) => setTimeout(r, 2500));
      } else if (result === "wait") {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  } finally {
    s.running = false;
    s.loop = null;
  }
}

export function ensureQueueLoop(): void {
  if (isServerless()) return;
  const s = state();
  if (s.loop) return;
  s.loop = loop();
}

export async function processQueueTick(opts?: { serverless?: boolean; maxJobs?: number }) {
  const maxJobs = Math.max(1, Math.min(8, opts?.maxJobs ?? 1));
  const results: string[] = [];
  for (let i = 0; i < maxJobs; i += 1) {
    results.push(await tick());
    const last = results[results.length - 1];
    if (last === "idle" || last === "paused" || last === "capped" || last === "wait") break;
    if (!opts?.serverless) break;
  }
  return results;
}

function wantsAuto(templateId: string, body?: string): boolean {
  if (!templateId || templateId === AUTO_TEMPLATE_ID) return true;
  return (body ?? "").trim() === AUTO_TEMPLATE_MARKER;
}

function isGenericDraft(message: string): boolean {
  const t = message.toLocaleLowerCase("tr");
  return t.includes("keşif notunu hazırladık") || t.includes("kapsam ve süre tek sayfada");
}

function pitchFromLead(
  vertical: Vertical,
  lead: {
    name: string;
    district: string;
    city: string;
    address: string;
    phone: string;
    website: string;
    notes: string;
    campaign?: { query: string } | null;
  },
) {
  return composePitch(vertical, {
    name: lead.name,
    district: lead.district,
    city: lead.city,
    address: lead.address,
    phone: lead.phone,
    website: lead.website,
    notes: lead.notes,
    campaignQuery: lead.campaign?.query ?? "",
  });
}

async function refreshGenericDrafts(owner: string, vertical: Vertical): Promise<void> {
  const jobs = await prisma.outreachJob.findMany({
    where: { tenantId: owner, status: "pending" },
    include: { lead: { include: { campaign: { select: { query: true } } } } },
    take: 80,
  });
  for (const job of jobs) {
    if (!isGenericDraft(job.message)) continue;
    const next = pitchFromLead(vertical, job.lead).body;
    if (!next || next === job.message) continue;
    await prisma.outreachJob.update({ where: { id: job.id }, data: { message: next } });
  }
}

export async function enqueueLeads(opts: {
  leadIds: string[];
  templateId?: string;
}): Promise<{ queued: number; skipped: number; pending: number }> {
  const owner = tid();
  const vertical = currentTenant().vertical;
  const rawId = (opts.templateId ?? "").trim();
  const template =
    rawId && rawId !== AUTO_TEMPLATE_ID
      ? await prisma.template.findFirst({ where: { id: rawId, tenantId: owner } })
      : null;
  if (rawId && rawId !== AUTO_TEMPLATE_ID && !template) throw new Error("Şablon bulunamadı");
  const useAuto = wantsAuto(rawId, template?.body);

  const { renderTemplate } = await import("../templates");
  let queued = 0;
  let skipped = 0;

  for (const leadId of opts.leadIds) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId: owner },
      include: { campaign: { select: { query: true } } },
    });
    if (!lead || !lead.phone) {
      skipped += 1;
      continue;
    }
    if (lead.status === "yazildi" || lead.status === "ilgilenmiyor") {
      skipped += 1;
      continue;
    }
    const open = await prisma.outreachJob.findFirst({
      where: { tenantId: owner, leadId, status: { in: ["pending", "queued", "sending"] } },
    });
    if (open) {
      skipped += 1;
      continue;
    }
    const pitch = pitchFromLead(vertical, lead);
    const message = useAuto
      ? pitch.body
      : renderTemplate(template!.body, lead)
          .replaceAll("{sektor}", pitch.sector)
          .replaceAll("{teklif}", pitch.offer);
    await prisma.outreachJob.create({
      data: {
        tenantId: owner,
        leadId,
        templateId: useAuto ? null : template!.id,
        message,
        status: "pending",
        channel: "whatsapp",
      },
    });
    queued += 1;
  }

  return { queued, skipped, pending: queued };
}

export async function moderateJobs(opts: {
  ids: string[];
  action: "approve" | "reject" | "edit";
  message?: string;
}): Promise<{ updated: number }> {
  const owner = tid();
  const ids = opts.ids.filter(Boolean);
  if (!ids.length) return { updated: 0 };
  const jobs = await prisma.outreachJob.findMany({
    where: { id: { in: ids }, tenantId: owner, status: "pending" },
  });
  let updated = 0;
  const settings = await getSettings();
  let offsetSec = 0;
  for (const job of jobs) {
    if (opts.action === "reject") {
      await prisma.outreachJob.update({
        where: { id: job.id },
        data: { status: "rejected", error: "Operatör reddetti" },
      });
      updated += 1;
      continue;
    }
    const message = (opts.message ?? job.message).trim();
    if (!message) continue;
    const wait = isServerless() ? 0 : jitter(settings.delayMinSec, settings.delayMaxSec) + offsetSec;
    if (!isServerless()) offsetSec += jitter(settings.delayMinSec, settings.delayMaxSec);
    await prisma.outreachJob.update({
      where: { id: job.id },
      data: {
        message,
        status: "queued",
        error: null,
        scheduledAt: new Date(Date.now() + wait * 1000),
      },
    });
    updated += 1;
  }
  if (updated && (opts.action === "approve" || opts.action === "edit")) {
    await updateSettings({ queueStopped: false, queuePaused: false });
    ensureQueueLoop();
  }
  return { updated };
}

export async function getQueueSnapshot() {
  const owner = tid();
  const settings = await getSettings();
  try {
    await refreshGenericDrafts(owner, currentTenant().vertical);
  } catch {
    // taslak yenileme kuyruğu göstermeyi durdurmasın
  }
  const [queued, pending, sending, sentToday, failed, current, pendingJobs, lastFailed] = await Promise.all([
    prisma.outreachJob.count({ where: { tenantId: owner, status: "queued" } }),
    prisma.outreachJob.count({ where: { tenantId: owner, status: "pending" } }),
    prisma.outreachJob.count({ where: { tenantId: owner, status: "sending" } }),
    sentTodayCount(),
    prisma.outreachJob.count({ where: { tenantId: owner, status: "failed" } }),
    prisma.outreachJob.findFirst({
      where: { tenantId: owner, status: { in: ["sending", "queued"] } },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      include: { lead: true },
    }),
    prisma.outreachJob.findMany({
      where: { tenantId: owner, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: { lead: { select: { name: true, phone: true } } },
    }),
    prisma.outreachJob.findFirst({
      where: { tenantId: owner, status: "failed", error: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { error: true },
    }),
  ]);

  return {
    paused: settings.queuePaused,
    stopped: settings.queueStopped,
    dailyCap: settings.dailyCap,
    delayMinSec: settings.delayMinSec,
    delayMaxSec: settings.delayMaxSec,
    cloud: await cloudConfigured(),
    serverless: isServerless(),
    queued,
    pending,
    sending,
    sentToday,
    failed,
    lastError: lastFailed?.error ?? null,
    current: current
      ? {
          id: current.id,
          status: current.status,
          name: current.lead.name,
          phone: current.lead.phone,
        }
      : null,
    drafts: pendingJobs.map((job) => ({
      id: job.id,
      name: job.lead.name,
      phone: job.lead.phone,
      message: job.message,
      channel: job.channel,
    })),
  };
}
