import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE, authConfigured } from "@/lib/session-token";

const PUBLIC = ["/giris", "/api/auth", "/api/instagram/webhook", "/api/outreach/tick"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!authConfigured() && process.env.VERCEL !== "1") {
    return NextResponse.next();
  }
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/giris";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
