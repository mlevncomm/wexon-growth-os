import { NextResponse } from "next/server";
import { badRequest, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{ name?: string; body?: string }>(request);
  if (!body) return badRequest("Geçersiz istek.");
  const name = (body.name ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!name || !text) {
    return NextResponse.json({ error: "Ad ve metin gerekli" }, { status: 400 });
  }
  const existing = await prisma.template.findFirst({ where: { name } });
  const template = existing
    ? await prisma.template.update({ where: { id: existing.id }, data: { body: text } })
    : await prisma.template.create({ data: { name, body: text } });
  return NextResponse.json(template, { status: existing ? 200 : 201 });
}
