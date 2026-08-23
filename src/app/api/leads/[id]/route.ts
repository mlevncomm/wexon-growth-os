import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { resolveSearchLocations } from "@/lib/search-scope";
import { badRequest, readJson } from "@/lib/http";
import { denyIfGuest } from "@/lib/session";
import { bustStatsCache } from "@/lib/stats";

export const dynamic = "force-dynamic";

const STATUSES = ["yeni", "yazildi", "donus_var", "ilgilenmiyor"] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson<{
    status?: string;
    notes?: string;
    consented?: boolean;
    phone?: string;
  }>(request);
  if (!body) return badRequest("Geçersiz istek.");

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
    const existing = await prisma.lead.findUnique({ where: { id } });
    const region = resolveSearchLocations(existing?.city ?? "")[0]?.regionCode ?? "";
    data.phone = normalizePhone(body.phone, region) ?? "";
  }

  try {
    const lead = await prisma.lead.update({ where: { id }, data });
    bustStatsCache();
    return NextResponse.json(lead);
  } catch {
    return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    await prisma.lead.delete({ where: { id } });
    bustStatsCache();
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch {
    return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  }
}
