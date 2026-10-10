import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, readJson } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { netgsmConfig, netgsmOriginate } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Netgsm santral üzerinden aramayı başlatır (numarayı elle çevirmeye gerek kalmaz).
export async function POST(request: Request) {
  return withTenant(async (ctx) => {
    const cfg = netgsmConfig();
    if (!cfg) return NextResponse.json({ error: "Netgsm ayarlı değil." }, { status: 400 });
    const body = await readJson<{ leadId?: string; phone?: string }>(request);
    if (!body) return badRequest("Geçersiz istek.");
    let phone = "";
    if (body.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: body.leadId, tenantId: ctx.tenantId }, select: { phone: true } });
      phone = lead?.phone ?? "";
    } else phone = normalizePhone(body.phone ?? "", "TR") ?? "";
    if (!/^\+90\d{10}$/.test(phone)) return badRequest("Netgsm ile sadece Türkiye numaraları aranabilir.");
    // "Bir daha arama" diyenleri santral üzerinden de arama
    const blocked = await prisma.lead.findFirst({
      where: { tenantId: ctx.tenantId, phone, notes: { contains: "· Bir daha arama" } }, select: { id: true },
    });
    if (blocked) return NextResponse.json({ error: "Bu numara daha önce “Bir daha arama” dedi." }, { status: 409 });
    try {
      const out = await netgsmOriginate(cfg, phone, body.leadId || `manual-${Date.now()}`);
      return NextResponse.json({ ok: true, ...out });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Netgsm araması başlatılamadı" }, { status: 502 });
    }
  });
}
