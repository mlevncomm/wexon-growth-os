import { NextResponse } from "next/server";
import { coachSnapshot, coachTurn, resetCoach } from "@/lib/coach";
import { badRequest, readJson } from "@/lib/http";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  return NextResponse.json(await coachSnapshot());
}

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = await readJson<{ message?: string }>(request);
  if (!body) return badRequest("Geçersiz istek.");
  try {
    return NextResponse.json(await coachTurn(typeof body.message === "string" ? body.message : ""));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Koç yanıt vermedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const url = new URL(request.url);
  const resetPlaybook = url.searchParams.get("playbook") === "1";
  return NextResponse.json(await resetCoach(resetPlaybook));
}
