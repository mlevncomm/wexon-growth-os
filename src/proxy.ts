import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE, authConfigured } from "@/lib/session-token";

const PUBLIC = ["/giris", "/api/auth", "/api/instagram/webhook", "/api/outreach/tick"];

function isPublic(pathname: string) {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }
  if (!authConfigured() && process.env.VERCEL !== "1") {
    return NextResponse.next();
  }
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const platformPage = pathname === "/platform" || pathname.startsWith("/platform/");
  const platformApi = pathname === "/api/platform" || pathname.startsWith("/api/platform/");
  if (platformPage) {
    if (session.role !== "platform" || session.impersonatorId) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (platformApi && session.role !== "platform") {
    return NextResponse.json({ error: "Yalnızca üst yönetici" }, { status: 403 });
  }

  if (
    session.role === "platform" &&
    !session.impersonatorId &&
    !session.tenantId &&
    !pathname.startsWith("/api/") &&
    pathname !== "/platform"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/platform";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
