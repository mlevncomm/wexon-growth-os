import { prisma } from "./prisma";
import { peekSettings } from "./settings";

export type DashboardStats = {
  leadsTotal: number;
  leadsToday: number;
  campaignsToday: number;
  queued: number;
  sentToday: number;
  dailyCap: number;
  yeni: number;
  yazildi: number;
  lastCampaign: {
    query: string;
    city: string;
    district: string;
    status: string;
    foundCount: number;
    targetCount: number;
  } | null;
  hasPlacesKey: boolean;
  waCloud: boolean;
  waLocal: string;
};

const g = globalThis as unknown as {
  __wexonStats?: { at: number; data: DashboardStats };
};

const TTL_MS = 3_000;

function todayUtc(): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function loadDashboardStats(force = false): Promise<DashboardStats> {
  const hit = g.__wexonStats;
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const start = todayUtc();
  const postgres = /postgres/i.test(process.env.DATABASE_URL ?? "");

  const [settings, lastCampaign, counts] = await Promise.all([
    peekSettings(),
    prisma.campaign.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        query: true,
        city: true,
        district: true,
        status: true,
        foundCount: true,
        targetCount: true,
      },
    }),
    postgres
      ? prisma.$queryRaw<
          Array<{
            leadsTotal: number;
            leadsToday: number;
            campaignsToday: number;
            queued: number;
            sentToday: number;
            yeni: number;
            yazildi: number;
          }>
        >`
          SELECT
            (SELECT COUNT(*)::int FROM "Lead") AS "leadsTotal",
            (SELECT COUNT(*)::int FROM "Lead" WHERE "createdAt" >= ${start}) AS "leadsToday",
            (SELECT COUNT(*)::int FROM "Campaign" WHERE "createdAt" >= ${start}) AS "campaignsToday",
            (SELECT COUNT(*)::int FROM "OutreachJob" WHERE status IN ('queued', 'sending')) AS queued,
            (SELECT COUNT(*)::int FROM "OutreachJob" WHERE status = 'sent' AND "sentAt" >= ${start}) AS "sentToday",
            (SELECT COUNT(*)::int FROM "Lead" WHERE status = 'yeni') AS yeni,
            (SELECT COUNT(*)::int FROM "Lead" WHERE status = 'yazildi') AS yazildi
        `.then((rows) => {
          const row = rows[0];
          return {
            leadsTotal: Number(row?.leadsTotal ?? 0),
            leadsToday: Number(row?.leadsToday ?? 0),
            campaignsToday: Number(row?.campaignsToday ?? 0),
            queued: Number(row?.queued ?? 0),
            sentToday: Number(row?.sentToday ?? 0),
            yeni: Number(row?.yeni ?? 0),
            yazildi: Number(row?.yazildi ?? 0),
          };
        })
      : Promise.all([
          prisma.lead.count(),
          prisma.lead.count({ where: { createdAt: { gte: start } } }),
          prisma.campaign.count({ where: { createdAt: { gte: start } } }),
          prisma.outreachJob.count({ where: { status: { in: ["queued", "sending"] } } }),
          prisma.outreachJob.count({ where: { status: "sent", sentAt: { gte: start } } }),
          prisma.lead.count({ where: { status: "yeni" } }),
          prisma.lead.count({ where: { status: "yazildi" } }),
        ]).then(([leadsTotal, leadsToday, campaignsToday, queued, sentToday, yeni, yazildi]) => ({
          leadsTotal,
          leadsToday,
          campaignsToday,
          queued,
          sentToday,
          yeni,
          yazildi,
        })),
  ]);

  const data: DashboardStats = {
    leadsTotal: counts?.leadsTotal ?? 0,
    leadsToday: counts?.leadsToday ?? 0,
    campaignsToday: counts?.campaignsToday ?? 0,
    queued: counts?.queued ?? 0,
    sentToday: counts?.sentToday ?? 0,
    dailyCap: settings.dailyCap,
    yeni: counts?.yeni ?? 0,
    yazildi: counts?.yazildi ?? 0,
    lastCampaign,
    hasPlacesKey: Boolean(settings.googlePlacesApiKey),
    waCloud: Boolean(settings.waCloudToken && settings.waPhoneNumberId),
    waLocal: "disconnected",
  };

  const scanning = data.lastCampaign && (data.lastCampaign.status === "running" || data.lastCampaign.status === "queued");
  g.__wexonStats = { at: scanning ? Date.now() - TTL_MS + 1_200 : Date.now(), data };
  return data;
}

export function bustStatsCache() {
  g.__wexonStats = undefined;
}
