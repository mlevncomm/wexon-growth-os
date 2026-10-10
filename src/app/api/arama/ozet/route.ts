import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import { budgetError, openRouterKey, summarize } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Görüşme bitince sonucu, WhatsApp numarasını ve yetkili adını çıkarır.
export async function POST(request: Request) {
  return withTenant(async (ctx) => {
    const body = await readJson<{ konusma?: string; isletme?: string; telefon?: string }>(request);
    if (!body?.konusma?.trim()) return badRequest("Görüşme dökümü boş.");
    const key = await openRouterKey();
    if (!key) return NextResponse.json({ error: "OpenRouter anahtarı yok." }, { status: 500 });
    const be = await budgetError(key);
    if (be) return NextResponse.json({ error: be }, { status: 402 });
    try {
      return NextResponse.json(await summarize(key, {
        konusma: body.konusma, isletme: body.isletme ?? "", telefon: body.telefon ?? "",
        firma: ctx.tenantName, wexon: ctx.vertical === "software",
      }));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Özet çıkarılamadı" }, { status: 502 });
    }
  });
}
