import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, readJson } from "@/lib/http";
import { enqueueLeads, ensureQueueLoop, getQueueSnapshot } from "@/lib/whatsapp/queue";
import { denyIfGuest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  ensureQueueLoop();
  return NextResponse.json(await getQueueSnapshot());
}

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{
    leadIds?: string[];
    templateId?: string;
    allMatching?: boolean;
    q?: string;
    status?: string;
  }>(request);
  if (!body) return badRequest("Geçersiz istek.");
  const templateId = body.templateId ?? "";
  if (!templateId) {
    return NextResponse.json({ error: "Şablon seçin." }, { status: 400 });
  }

  let leadIds = body.leadIds ?? [];
  if (body.allMatching) {
    const q = (body.q ?? "").trim();
    const status = (body.status ?? "").trim();
    const rows = await prisma.lead.findMany({
      where: {
        ...(status ? { status } : {}),
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
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true },
    });
    leadIds = rows.map((r) => r.id);
  }

  if (!leadIds.length) {
    return NextResponse.json(
      { error: "Şablon ve en az bir müşteri seçin." },
      { status: 400 },
    );
  }
  try {
    const result = await enqueueLeads({ leadIds, templateId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kuyruk oluşmadı";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
