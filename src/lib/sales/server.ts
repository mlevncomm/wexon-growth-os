import "server-only";
import { llmChat } from "../llm";
import { getPlaybook, playbookToPrompt } from "../playbook";
import { prisma } from "../prisma";
import { getSettings } from "../settings";
import { currentTenant, tenantId } from "../tenant";
import { categoryById, type CategoryId, type StyleId } from "./categories";
import { buildContext, type ContactRecord } from "./context";
import type { ChatFn } from "./engine";

// Satış mesajı katmanının veritabanı ve AI bağlantısı. Mesaj göndermez.

/** Operatörün WhatsApp'ta açtığı mesajların kaydı (kuyruk bunları göndermez) */
export const WA_LINK_CHANNEL = "wa-link";
export const OPENED_STATUS = "opened";
export const SALES_TAG = "satis";

export function salesTag(category: CategoryId, style: StyleId | "elle") {
  return `${SALES_TAG}:${category}:${style}`;
}

export async function loadLead(leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenantId() },
    include: { campaign: { select: { query: true } } },
  });
}

export async function previousContacts(leadId: string): Promise<ContactRecord[]> {
  const jobs = await prisma.outreachJob.findMany({
    where: { tenantId: tenantId(), leadId, status: { in: ["sent", OPENED_STATUS] } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { message: true, sentAt: true, createdAt: true, templateId: true },
  });
  return jobs.map((j) => ({
    message: j.message,
    at: (j.sentAt ?? j.createdAt).toISOString(),
    category: j.templateId?.startsWith(`${SALES_TAG}:`) ? j.templateId.split(":")[1] : undefined,
  }));
}

export async function leadContext(
  leadId: string,
  input: { senderName?: string; designLink?: string; customerReply?: string },
) {
  const lead = await loadLead(leadId);
  if (!lead) return null;
  const [contacts, playbook] = await Promise.all([previousContacts(lead.id), getPlaybook()]);
  const ctx = buildContext({
    lead,
    campaignQuery: lead.campaign?.query ?? "",
    previousContacts: contacts,
    designLink: input.designLink,
    customerReply: input.customerReply,
    brand: currentTenant().tenantName,
    senderName: input.senderName,
    playbookOffer: playbook.offer,
  });
  return { lead, ctx, operatorPlaybook: playbookToPrompt(playbook) };
}

export async function salesChat(): Promise<ChatFn | undefined> {
  const settings = await getSettings();
  if (!settings.llmApiKey) return undefined;
  return (messages, opts) =>
    llmChat({
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl,
      model: settings.llmModel,
      messages,
      json: true,
      temperature: opts?.temperature ?? 0.7,
      maxTokens: 2400,
    });
}

/** Son 24 saatteki temaslar; arayüz aynı türde ikinci mesajda uyarır (mükerrer) */
export async function recentContacts(leadId: string) {
  const jobs = await prisma.outreachJob.findMany({
    where: {
      tenantId: tenantId(),
      leadId,
      status: { in: ["sent", OPENED_STATUS, "pending", "queued", "sending"] },
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { createdAt: true, status: true, templateId: true },
  });
  // Kuyruk işleri (satış etiketi olmayan) ilk temas sayılır
  return jobs.map((j) => ({
    at: j.createdAt.toISOString(),
    status: j.status,
    category: j.templateId?.startsWith(`${SALES_TAG}:`) ? j.templateId.split(":")[1] : "ilk_temas",
  }));
}

/** Lead'in durumu, gönderilen mesaj türüne göre nasıl ilerler */
export function nextStatus(current: string, category: CategoryId): string | null {
  if (category === "kapanis") return current === "ilgilenmiyor" ? null : "ilgilenmiyor";
  const c = categoryById(category);
  if (c.needsReply && ["yeni", "yazildi", "ulasilamadi"].includes(current)) return "donus_var";
  if (current === "yeni") return "yazildi";
  return null;
}
