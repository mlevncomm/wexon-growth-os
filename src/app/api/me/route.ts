import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { ctxFromSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const ctx = await ctxFromSession(session);
  const impersonator = session.impersonatorId
    ? await prisma.user.findUnique({ where: { id: session.impersonatorId }, select: { email: true } })
    : null;
  return NextResponse.json({
    email: session.email,
    role: session.role,
    tenantId: ctx?.tenantId ?? null,
    tenantName: ctx?.tenantName ?? null,
    tenantSlug: ctx?.tenantSlug ?? null,
    vertical: ctx?.vertical ?? null,
    impersonating: Boolean(session.impersonatorId),
    impersonatorEmail: impersonator?.email ?? null,
    home: session.role === "platform" && !session.impersonatorId && !session.tenantId ? "/platform" : "/",
  });
}
