import { NextResponse } from "next/server";
import {
  findTenantIdByIgUser,
  findTenantIdByVerifyToken,
  upsertInbound,
} from "@/lib/instagram";
import { ctxForTenantId, runWithTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !token) {
    return NextResponse.json({ error: "Doğrulama başarısız" }, { status: 403 });
  }
  const tenantId = await findTenantIdByVerifyToken(token);
  if (!tenantId) {
    return NextResponse.json({ error: "Doğrulama başarısız" }, { status: 403 });
  }
  return new NextResponse(challenge ?? "", { status: 200 });
}

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { text?: string };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    object?: string;
    entry?: Array<{ id?: string; messaging?: MessagingEvent[]; changes?: unknown }>;
  } | null;
  if (!payload) return NextResponse.json({ ok: true });

  for (const entry of payload.entry ?? []) {
    const igUserId = entry.id || entry.messaging?.[0]?.recipient?.id || "";
    const tenantId = igUserId ? await findTenantIdByIgUser(igUserId) : null;
    const ctx = tenantId ? await ctxForTenantId(tenantId) : null;
    if (!ctx) continue;
    await runWithTenant(ctx, async () => {
      for (const event of entry.messaging ?? []) {
        const igsid = event.sender?.id;
        const text = event.message?.text?.trim();
        if (!igsid || !text) continue;
        const at = event.timestamp ? new Date(event.timestamp) : new Date();
        try {
          await upsertInbound({ igsid, text, at });
        } catch {
          /* webhook must still 200 */
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
