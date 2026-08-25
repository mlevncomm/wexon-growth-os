import { prisma } from "./prisma";
import { tenantId } from "./tenant";

export type Playbook = {
  tone: string;
  rules: string;
  forbidden: string;
  offer: string;
  cta: string;
};

function asText(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.replace(/\s+\n/g, "\n").trim().slice(0, max) : "";
}

export function playbookIsActive(playbook: Playbook): boolean {
  return Boolean(
    playbook.tone || playbook.rules || playbook.forbidden || playbook.offer || playbook.cta,
  );
}

export function playbookToPrompt(playbook: Playbook): string {
  if (!playbookIsActive(playbook)) return "";
  const lines = ["Marka playbook (öğretilen kurallar, bunlara uy):"];
  if (playbook.tone) lines.push(`Ton: ${playbook.tone}`);
  if (playbook.rules) lines.push(`Kurallar: ${playbook.rules}`);
  if (playbook.forbidden) lines.push(`Yasak kelime/ifade: ${playbook.forbidden}`);
  if (playbook.offer) lines.push(`Teklif dili: ${playbook.offer}`);
  if (playbook.cta) lines.push(`CTA: ${playbook.cta}`);
  return lines.join("\n");
}

export function mergePlaybook(current: Playbook, incoming: unknown): Playbook {
  const next = incoming && typeof incoming === "object" ? (incoming as Record<string, unknown>) : {};
  const pick = (key: keyof Playbook): string => {
    const raw = asText(next[key]);
    if (!raw || /^(aynı|_keep|keep|unchanged)$/i.test(raw)) return current[key];
    return raw;
  };
  return {
    tone: pick("tone"),
    rules: pick("rules"),
    forbidden: pick("forbidden"),
    offer: pick("offer"),
    cta: pick("cta"),
  };
}

export async function getPlaybook(): Promise<Playbook> {
  const id = tenantId();
  const row = await prisma.brandPlaybook.upsert({
    where: { tenantId: id },
    update: {},
    create: { tenantId: id },
  });
  return {
    tone: row.tone,
    rules: row.rules,
    forbidden: row.forbidden,
    offer: row.offer,
    cta: row.cta,
  };
}

export async function savePlaybook(playbook: Playbook): Promise<Playbook> {
  const id = tenantId();
  const row = await prisma.brandPlaybook.upsert({
    where: { tenantId: id },
    update: playbook,
    create: { tenantId: id, ...playbook },
  });
  return {
    tone: row.tone,
    rules: row.rules,
    forbidden: row.forbidden,
    offer: row.offer,
    cta: row.cta,
  };
}
