import { NextResponse } from "next/server";
import { resumeStaleCampaign } from "@/lib/campaigns";
import { denyIfGuest } from "@/lib/session";
import { bustStatsCache } from "@/lib/stats";
import { processQueueTick } from "@/lib/whatsapp/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const okCron = Boolean(cron) && header === `Bearer ${cron}`;
  if (!okCron) {
    const denied = await denyIfGuest();
    if (denied) return denied;
  }
  const result = await processQueueTick({ serverless: true, maxJobs: 3 });
  const idle = result.every((r) => r === "idle" || r === "paused" || r === "capped");
  const campaign = idle ? await resumeStaleCampaign() : null;
  bustStatsCache();
  return NextResponse.json({ ok: true, result, campaign });
}

export async function POST(request: Request) {
  return GET(request);
}
