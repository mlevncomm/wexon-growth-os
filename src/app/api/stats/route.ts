import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/campaigns";
import { databaseUnavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { denyIfGuest } from "@/lib/session";
import { cloudConfigured } from "@/lib/whatsapp/cloud";
import { getLocalStatus } from "@/lib/whatsapp/local";
import { sentTodayCount } from "@/lib/whatsapp/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  try {
    await ensureSeed();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [
      leadsTotal,
      leadsToday,
      campaignsToday,
      queued,
      sentToday,
      yeni,
      yazildi,
      settings,
      lastCampaign,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: start } } }),
      prisma.campaign.count({ where: { createdAt: { gte: start } } }),
      prisma.outreachJob.count({ where: { status: { in: ["queued", "sending"] } } }),
      sentTodayCount(),
      prisma.lead.count({ where: { status: "yeni" } }),
      prisma.lead.count({ where: { status: "yazildi" } }),
      getSettings(),
      prisma.campaign.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({
      leadsTotal,
      leadsToday,
      campaignsToday,
      queued,
      sentToday,
      dailyCap: settings.dailyCap,
      yeni,
      yazildi,
      lastCampaign,
      hasPlacesKey: Boolean(settings.googlePlacesApiKey),
      waCloud: await cloudConfigured(),
      waLocal: getLocalStatus().state,
    });
  } catch (err) {
    return databaseUnavailable(err);
  }
}
