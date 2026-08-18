import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import {
  authConfigured,
  credentialsMatch,
  encodeSession,
  readSession,
  sessionCookie,
  SESSION_COOKIE,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const hits = new Map<string, { n: number; t: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip) ?? { n: 0, t: now };
  if (now - row.t > 10 * 60 * 1000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  row.n += 1;
  hits.set(ip, row);
  return row.n > 12;
}

export async function GET() {
  const session = await readSession();
  return NextResponse.json({
    ok: Boolean(session),
    email: session?.email ?? null,
    configured: authConfigured(),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Çok fazla deneme. 10 dakika bekleyin." }, { status: 429 });
  }
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Admin bilgisi yok. AUTH_SECRET, ADMIN_EMAIL ve ADMIN_PASSWORD yazın." },
      { status: 400 },
    );
  }
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!credentialsMatch(email, password)) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  const cookie = sessionCookie(encodeSession(email.trim().toLowerCase()));
  res.cookies.set(cookie);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
