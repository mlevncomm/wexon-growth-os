import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import {
  approveAndSend,
  draftForThread,
  igConfigured,
  listLocalThreads,
  refreshIgInbox,
  saveDraft,
  sendIgMessage,
  upsertInbound,
} from "@/lib/instagram";
import { prisma } from "@/lib/prisma";
import { deployHints } from "@/lib/platform";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const configured = await igConfigured();
  const result = configured ? await refreshIgInbox() : { threads: await listLocalThreads(), warning: "Instagram bağlı değil" };
  const deploy = deployHints();
  return NextResponse.json({
    configured,
    threads: result.threads,
    warning: result.warning,
    webhookPath: "/api/instagram/webhook",
    webhookUrl: deploy.instagramWebhookUrl,
    appUrl: deploy.appUrl,
    hosted: deploy.hosted,
  });
}

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{
    action?: string;
    threadId?: string;
    text?: string;
    igsid?: string;
    username?: string;
    inbound?: string;
  }>(request);
  if (!body) return badRequest("Geçersiz istek.");
  const action = body.action ?? "";

  try {
    if (action === "refresh") {
      return NextResponse.json(await refreshIgInbox());
    }
    if (action === "draft") {
      const threadId = body.threadId ?? "";
      if (!threadId) return badRequest("Konuşma seçin.");
      const draft = await draftForThread(threadId, body.inbound);
      return NextResponse.json({ draft });
    }
    if (action === "save") {
      const threadId = body.threadId ?? "";
      const text = typeof body.text === "string" ? body.text : "";
      if (!threadId) return badRequest("Konuşma seçin.");
      await saveDraft(threadId, text);
      return NextResponse.json({ ok: true });
    }
    if (action === "send") {
      const threadId = body.threadId ?? "";
      const text = (body.text ?? "").trim();
      if (!threadId || !text) return badRequest("Onaylı metin gerekli.");
      await approveAndSend(threadId, text);
      return NextResponse.json({ ok: true, threads: await listLocalThreads() });
    }
    if (action === "manual") {
      const igsid = (body.igsid ?? "").trim();
      const text = (body.text ?? "").trim();
      if (!igsid || !text) return badRequest("IGSID ve onaylı metin gerekli.");
      await sendIgMessage(igsid, text);
      await prisma.igThread.upsert({
        where: { id: igsid },
        update: { igsid, username: body.username ?? undefined, lastText: text.slice(0, 500), lastAt: new Date(), draft: "" },
        create: { id: igsid, igsid, username: body.username ?? "", lastText: text.slice(0, 500), lastAt: new Date() },
      });
      await prisma.igMessage.create({ data: { threadId: igsid, direction: "out", body: text.slice(0, 2000) } });
      return NextResponse.json({ ok: true });
    }
    if (action === "simulate") {
      const igsid = (body.igsid ?? "demo").trim() || "demo";
      const inbound = (body.inbound ?? body.text ?? "").trim();
      if (!inbound) return badRequest("Gelen metin gerekli.");
      const saved = await upsertInbound({ igsid, username: body.username, text: inbound });
      return NextResponse.json(saved);
    }
    return badRequest("Bilinmeyen eylem.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instagram işlemi başarısız";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
