import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, readJson } from "@/lib/http";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readJson<{ name?: string; body?: string }>(request);
  if (!body) return badRequest("Geçersiz istek.");
  try {
    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        ...(typeof body.body === "string" ? { body: body.body } : {}),
      },
    });
    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "Şablon yok" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const { id } = await context.params;
  const remaining = await prisma.template.count();
  if (remaining <= 1) {
    return NextResponse.json({ error: "En az bir şablon kalmalı" }, { status: 400 });
  }
  try {
    await prisma.template.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Şablon silinemedi" }, { status: 404 });
  }
}
