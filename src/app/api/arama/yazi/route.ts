import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import { budgetError, openRouterKey, transcribe, validAudio } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Müşterinin ses kaydını yazıya döker (~0,003 sent/cümle).
export async function POST(request: Request) {
  return withTenant(async () => {
    const body = await readJson<{ audio?: unknown; baglam?: unknown }>(request);
    if (!body || !validAudio(body.audio)) return badRequest("Ses kaydı geçersiz.");
    const key = await openRouterKey();
    if (!key) return NextResponse.json({ error: "OpenRouter anahtarı yok." }, { status: 500 });
    const be = await budgetError(key);
    if (be) return NextResponse.json({ error: be }, { status: 402 });
    try {
      return NextResponse.json(await transcribe(key, body.audio, typeof body.baglam === "string" ? body.baglam : ""));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Yazıya dökülemedi" }, { status: 502 });
    }
  });
}
