import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, readJson } from "@/lib/http";
import { updateSettings } from "@/lib/settings";
import { ensureQueueLoop } from "@/lib/whatsapp/queue";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{ action?: string }>(request);
  const action = body?.action;

  if (action === "pause") {
    await updateSettings({ queuePaused: true, queueStopped: false });
  } else if (action === "resume") {
    await updateSettings({ queuePaused: false, queueStopped: false });
    ensureQueueLoop();
  } else if (action === "stop") {
    await updateSettings({ queueStopped: true, queuePaused: false });
    await prisma.outreachJob.updateMany({
      where: { status: { in: ["queued", "sending"] } },
      data: { status: "cancelled", error: "Operatör durdurdu" },
    });
  } else {
    return badRequest("Bilinmeyen işlem");
  }

  return NextResponse.json({ ok: true });
}
