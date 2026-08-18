import { NextResponse } from "next/server";
import { upsertInbound } from "@/lib/instagram";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const settings = await getSettings();
  if (mode === "subscribe" && settings.igWebhookVerifyToken && token === settings.igWebhookVerifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Doğrulama başarısız" }, { status: 403 });
}

type MessagingEvent = {
  sender?: { id?: string };
  timestamp?: number;
  message?: { text?: string };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    object?: string;
    entry?: Array<{ messaging?: MessagingEvent[]; changes?: unknown }>;
  } | null;
  if (!payload) return NextResponse.json({ ok: true });

  for (const entry of payload.entry ?? []) {
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
  }
  return NextResponse.json({ ok: true });
}
