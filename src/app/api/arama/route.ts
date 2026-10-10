import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable } from "@/lib/http";
import { composePitch } from "@/lib/pitch";
import { balance, callAttempts, MAX_ATTEMPTS, netgsmConfig, openRouterKey } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Arama sırası: önce geri aranacaklar, sonra yeniler, WhatsApp'tan yazılıp dönmeyenler, en son açmayanlar
const RANK: Record<string, number> = { geri_ara: 0, yeni: 1, yazildi: 2, ulasilamadi: 3 };
const RETRY_AFTER_MS = 2 * 60 * 60 * 1000;

/** Türkiye saatiyle bugünün başlangıcı (sunucu UTC'de çalışsa da). */
function istanbulDayStart() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${p}T00:00:00+03:00`);
}

type LogDetail = { leadId?: string; isletme?: string; sonuc?: string; maliyet?: number; konusma?: string };

export async function GET(request: Request) {
  return withTenant(async (ctx) => {
    try {
      const url = new URL(request.url);
      const withSite = url.searchParams.get("site") === "1";
      const wanted = url.searchParams.get("lead");
      const rows = await prisma.lead.findMany({
        where: {
          tenantId: ctx.tenantId,
          phone: { not: "" },
          OR: [
            { status: { in: Object.keys(RANK) }, ...(withSite ? {} : { website: "" }) },
            ...(wanted ? [{ id: wanted }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 400,
        include: { campaign: { select: { query: true } } },
      });
      const now = Date.now();
      const all = rows.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        sector: l.campaign?.query ?? "",
        district: l.district,
        city: l.city,
        rating: l.rating,
        reviewCount: l.reviewCount,
        mapsUrl: l.mapsUrl,
        website: l.website,
        notes: l.notes,
        attempts: callAttempts(l.notes),
        updatedAt: l.updatedAt.getTime(),
        // Açmayanlara gidecek WhatsApp mesajı: Growth OS'un Koç kurallarına uyan otomatik metin
        pitch: composePitch(ctx.vertical, {
          name: l.name, district: l.district, city: l.city, address: l.address, phone: l.phone,
          website: l.website, notes: l.notes, campaignQuery: l.campaign?.query ?? "",
        }).body,
      }));
      const leads = all
        .filter((l) => l.id !== wanted && l.status in RANK && (withSite || !l.website))
        .filter((l) => l.status !== "ulasilamadi" || (l.attempts < MAX_ATTEMPTS && now - l.updatedAt > RETRY_AFTER_MS))
        .sort((a, b) => RANK[a.status] - RANK[b.status] || a.updatedAt - b.updatedAt)
        .slice(0, 60);
      const focus = wanted ? all.find((l) => l.id === wanted) ?? null : null;

      // Bugünkü aramalar (Türkiye saati)
      const logs = await prisma.auditLog.findMany({
        where: { tenantId: ctx.tenantId, action: "ai_arama", createdAt: { gte: istanbulDayStart() } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const today = logs.map((log) => {
        let d: LogDetail = {};
        try { d = JSON.parse(log.detail) as LogDetail; } catch {}
        return { id: log.id, at: log.createdAt.getTime(), leadId: d.leadId ?? "", isletme: d.isletme ?? "", sonuc: d.sonuc ?? "", maliyet: Number(d.maliyet) || 0, konusma: d.konusma ?? "" };
      });

      const key = await openRouterKey();
      return NextResponse.json({
        brand: { name: ctx.tenantName, vertical: ctx.vertical },
        leads,
        focus,
        today,
        stats: {
          bugun: today.length,
          bugunIlgilendi: today.filter((t) => t.sonuc === "ilgilendi").length,
          bugunHarcama: today.reduce((n, t) => n + t.maliyet, 0),
        },
        keyReady: Boolean(key),
        netgsmReady: Boolean(netgsmConfig()),
        balanceUsd: key ? await balance(key, url.searchParams.get("fresh") === "1") : null,
      });
    } catch (err) {
      return databaseUnavailable(err);
    }
  });
}
