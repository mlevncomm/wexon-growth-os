import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import { budgetError, chatBody, cleanMessages, currentBrand, openRouterKey, openRouterStream, validAudio, type LeadContext } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Görüşmenin bir turu: OpenRouter akışını (ses + yazı) tarayıcıya aynen aktarır.
export async function POST(request: Request) {
  return withTenant(async () => {
    const body = await readJson<{ kind?: string; voice?: string; lead?: LeadContext; messages?: unknown; fallback?: boolean; premium?: boolean; audio?: unknown }>(request);
    if (!body) return badRequest("Geçersiz istek.");
    const [key, brand] = await Promise.all([openRouterKey(), currentBrand()]);
    if (!key) return NextResponse.json({ error: "OpenRouter anahtarı yok. Sistem ekranında OpenRouter anahtarını kaydet." }, { status: 500 });
    const be = await budgetError(key);
    if (be) return NextResponse.json({ error: be }, { status: 402 });
    const messages = cleanMessages(body.messages);
    const audio = validAudio(body.audio) ? body.audio : undefined;
    if (!messages.length && !audio) return badRequest("Mesaj yok.");

    const upstream = await openRouterStream(
      key,
      chatBody({
        kind: body.kind === "voice" ? "voice" : "text",
        voice: String(body.voice || ""),
        premium: body.premium === true,
        lead: body.lead ?? {},
        messages,
        fallback: Boolean(body.fallback),
        brand,
        audio: body.kind === "voice" ? audio : undefined,
      }),
      request.signal,
    );
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json({ error: `OpenRouter hatası (${upstream.status}): ${text.slice(0, 400)}` }, { status: upstream.status || 502 });
    }
    return new NextResponse(upstream.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform" },
    });
  });
}
