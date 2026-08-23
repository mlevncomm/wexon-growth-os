import { NextResponse } from "next/server";
import { badRequest, databaseUnavailable, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

function leadWhere(opts: { q?: string; status?: string; campaignId?: string }) {
  const q = (opts.q ?? "").trim();
  const status = (opts.status ?? "").trim();
  const campaignId = (opts.campaignId ?? "").trim();
  return {
    ...(status ? { status } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { address: { contains: q } },
            { phone: { contains: q } },
            { district: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {}),
  };
}

export async function GET(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const takeRaw = Number(searchParams.get("take") ?? 400);
    const take = Number.isFinite(takeRaw) ? Math.min(400, Math.max(1, Math.floor(takeRaw))) : 400;
    const leads = await prisma.lead.findMany({
      where: leadWhere({
        q: searchParams.get("q") ?? "",
        status: searchParams.get("status") ?? "",
        campaignId: searchParams.get("campaignId") ?? "",
      }),
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json(leads);
  } catch (err) {
    return databaseUnavailable(err);
  }
}

export async function DELETE(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{
    leadIds?: string[];
    allMatching?: boolean;
    q?: string;
    status?: string;
  }>(request);
  if (!body) return badRequest("Geçersiz istek.");

  if (body.allMatching) {
    const result = await prisma.lead.deleteMany({
      where: leadWhere({ q: body.q, status: body.status }),
    });
    return NextResponse.json({ deleted: result.count });
  }

  const leadIds = [...new Set((body.leadIds ?? []).map((id) => String(id).trim()).filter(Boolean))].slice(0, 500);
  if (!leadIds.length) return badRequest("Silinecek müşteri seçin.");

  const result = await prisma.lead.deleteMany({
    where: { id: { in: leadIds } },
  });
  return NextResponse.json({ deleted: result.count });
}
