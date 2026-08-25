import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import { isServerless } from "@/lib/platform";
import { withTenant } from "@/lib/tenant";
import { cloudConfigured } from "@/lib/whatsapp/cloud";
import {
  destroyLocalSession,
  getLocalStatus,
  startLocalSession,
} from "@/lib/whatsapp/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withTenant(async () => {
    const local = isServerless()
      ? { state: "disconnected" as const, qrDataUrl: null, error: "QR yalnızca bu makinede. Canlıda Cloud kullanın." }
      : getLocalStatus();
    return NextResponse.json({
      cloud: await cloudConfigured(),
      local,
      serverless: isServerless(),
    });
  });
}

export async function POST(request: Request) {
  return withTenant(async () => {
    const body = await readJson<{ action?: string }>(request);
    if (isServerless() && body?.action === "connect") {
      return NextResponse.json(
        { error: "Vercel’de WhatsApp QR çalışmaz. Cloud API bağlayın." },
        { status: 400 },
      );
    }
    if (body?.action === "connect") {
      await destroyLocalSession();
      const local = await startLocalSession();
      return NextResponse.json({ cloud: await cloudConfigured(), local });
    }
    if (body?.action === "disconnect") {
      await destroyLocalSession();
      return NextResponse.json({
        cloud: await cloudConfigured(),
        local: getLocalStatus(),
      });
    }
    return badRequest("Bilinmeyen işlem");
  });
}
