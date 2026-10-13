import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  APP_PROFILES,
  decodeProfile,
  encodeProfile,
  inProfileGroup,
  pinHashFor,
  PIN_MAX_TRIES,
  PIN_WINDOW_MS,
  PROFILE_COOKIE,
  profileById,
  profileCookie,
} from "@/lib/app-profiles";
import { badRequest, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function groupSession() {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Giriş gerekli" }, { status: 401 }) };
  if (session.role !== "member" || !inProfileGroup(session.tenantId)) {
    return { error: NextResponse.json({ error: "Bu hesapta profil yok" }, { status: 404 }) };
  }
  return { session };
}

/** Kilit, son PIN_MAX_TRIES yanlış denemenin ilki pencereden çıkınca biter */
async function lockUntil(userId: string, tenantId: string): Promise<number | null> {
  const recent = await prisma.auditLog.findMany({
    where: { actorId: userId, tenantId, action: "profile.pin_failed", createdAt: { gte: new Date(Date.now() - PIN_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: PIN_MAX_TRIES,
    select: { createdAt: true },
  });
  if (recent.length < PIN_MAX_TRIES) return null;
  return recent[PIN_MAX_TRIES - 1].createdAt.getTime() + PIN_WINDOW_MS;
}

/** Profil listesi ve şu an açık profil (şifreler ya da özetler asla dönmez) */
export async function GET() {
  const g = await groupSession();
  if (g.error) return g.error;
  const { session } = g;
  const jar = await cookies();
  const current = decodeProfile(jar.get(PROFILE_COOKIE)?.value, session.userId);
  const profiller = await Promise.all(
    APP_PROFILES.map(async (p) => {
      const [son, kilit] = await Promise.all([
        prisma.auditLog.findFirst({
          where: { actorId: session.userId, tenantId: p.tenantId, action: "profile.opened" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        lockUntil(session.userId, p.tenantId),
      ]);
      return { ...p, sifreAyarli: Boolean(pinHashFor(p.tenantId)), sonAcilis: son?.createdAt.toISOString() ?? null, kilitBitis: kilit };
    }),
  );
  return NextResponse.json({ profiller, acik: current?.tenantId ?? null, eposta: session.email });
}

/** Profil aç: { tenantId, pin } */
export async function POST(request: Request) {
  const g = await groupSession();
  if (g.error) return g.error;
  const { session } = g;
  const body = await readJson<{ tenantId?: string; pin?: string }>(request);
  const profile = profileById(String(body?.tenantId ?? ""));
  if (!profile) return badRequest("Profil bulunamadı.");
  const pin = String(body?.pin ?? "");
  if (!/^\d{4,8}$/.test(pin)) return badRequest("Profil şifresi 4-8 rakam olmalı.");
  const hash = pinHashFor(profile.tenantId);
  if (!hash) return NextResponse.json({ error: "Bu profilin şifresi henüz ayarlanmamış." }, { status: 503 });

  // Deneme sınırı denetim kaydından sayılır (sunucu örneklerinden bağımsız, kalıcı)
  const since = new Date(Date.now() - PIN_WINDOW_MS);
  const failures = await prisma.auditLog.count({
    where: { actorId: session.userId, tenantId: profile.tenantId, action: "profile.pin_failed", createdAt: { gte: since } },
  });
  if (failures >= PIN_MAX_TRIES) {
    const kilitBitis = await lockUntil(session.userId, profile.tenantId);
    return NextResponse.json({ error: "Çok fazla yanlış deneme. Bu profil kısa süreliğine kilitlendi.", kilitBitis }, { status: 429 });
  }

  const ok = await verifyPassword(pin, hash);
  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      actorEmail: session.email,
      tenantId: profile.tenantId,
      action: ok ? "profile.opened" : "profile.pin_failed",
      detail: JSON.stringify({ profil: profile.ad }),
    },
  });
  if (!ok) {
    const left = Math.max(0, PIN_MAX_TRIES - failures - 1);
    if (!left) {
      const kilitBitis = await lockUntil(session.userId, profile.tenantId);
      return NextResponse.json({ error: "Şifre yanlış. Bu profil kısa süreliğine kilitlendi.", kalan: 0, kilitBitis }, { status: 429 });
    }
    return NextResponse.json({ error: `Şifre yanlış. ${left} deneme hakkınız kaldı.`, kalan: left }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, profil: profile.ad, git: "/ara" });
  res.cookies.set(profileCookie(encodeProfile(session.userId, profile.tenantId)));
  return res;
}

/** Profilden çık (profil seçim ekranına döner) */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...profileCookie(""), maxAge: 0 });
  return res;
}
