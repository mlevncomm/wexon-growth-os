import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { resolveSearchLocations } from "@/lib/search-scope";
import { badRequest, readJson } from "@/lib/http";
import { bustStatsCache } from "@/lib/stats";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const STATUSES = ["yeni", "yazildi", "donus_var", "ilgilenmiyor"] as const;

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
      if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
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
