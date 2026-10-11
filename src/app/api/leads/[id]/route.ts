import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { resolveSearchLocations } from "@/lib/search-scope";
import { badRequest, readJson } from "@/lib/http";
import { LEAD_STATUSES } from "@/lib/lead-status";
import { bustStatsCache } from "@/lib/stats";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const STATUSES = LEAD_STATUSES.map((s) => s.value);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTenant(async (ctx) => {
    const { id } = await context.params;
    const body = await readJson<{
      status?: string;
      notes?: string;
      consented?: boolean;
      phone?: string;
    }>(request);
    if (!body) return badRequest("Geçersiz istek.");

    const existing = await prisma.lead.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    const data: {
      status?: string;
      notes?: string;
      consented?: boolean;
      phone?: string;
    } = {};

    if (body.status) {
      if (!(STATUSES as string[]).includes(body.status)) {
        return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
      }
      data.status = body.status;
    }
    if (typeof body.notes === "string") data.notes = body.notes;
    if (typeof body.consented === "boolean") data.consented = body.consented;
    if (typeof body.phone === "string") {
      const region = resolveSearchLocations(existing.city ?? "")[0]?.regionCode ?? "";
      data.phone = normalizePhone(body.phone, region) ?? "";
    }

    const lead = await prisma.lead.update({ where: { id: existing.id }, data });
    // İleti onayı ve ret kayıtları kim, ne zaman sorusuna cevap verebilmek için denetim kaydına yazılır
    const events: string[] = [];
    if (typeof data.consented === "boolean" && data.consented !== existing.consented) {
      events.push(data.consented ? "lead.consent.granted" : "lead.consent.revoked");
    }
    if (data.status === "ilgilenmiyor" && existing.status !== "ilgilenmiyor") events.push("lead.opt_out");
    if (data.status && existing.status === "ilgilenmiyor" && data.status !== "ilgilenmiyor") events.push("lead.opt_out.cleared");
    if (events.length) {
      await prisma.auditLog.createMany({
        data: events.map((action) => ({
          actorId: ctx.userId,
          actorEmail: ctx.email,
          tenantId: ctx.tenantId,
          action,
          detail: JSON.stringify({ leadId: existing.id, kaynak: "musteriler-ekrani" }),
        })),
      });
    }
    bustStatsCache(ctx.tenantId);
    return NextResponse.json(lead);
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTenant(async (ctx) => {
    const { id } = await context.params;
    const result = await prisma.lead.deleteMany({ where: { id, tenantId: ctx.tenantId } });
    if (!result.count) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    bustStatsCache(ctx.tenantId);
    return NextResponse.json({ ok: true, deleted: 1 });
  });
}
