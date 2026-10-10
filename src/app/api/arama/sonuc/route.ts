import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, databaseUnavailable, readJson } from "@/lib/http";
import { isWhatsAppCapablePhone, normalizePhone } from "@/lib/phone";
import { bustStatsCache } from "@/lib/stats";
import { CALL_MARK, isOutcome, outcomeOf } from "@/lib/arama/server";
import { withTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  leadId?: string;
  manual?: { name?: string; phone?: string; city?: string; district?: string };
  sonuc?: string;
  whatsapp?: string;
  yetkili?: string;
  geriArama?: string;
  ozet?: string;
  maliyet?: number;
  konusma?: string;
  takipMesaji?: string;
  kuyruga?: boolean;
};

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

// Arama sonucunu kaydeder: müşteri durumu + not, arama kaydı, istenirse onaylı WhatsApp takip mesajı.
export async function POST(request: Request) {
  return withTenant(async (ctx) => {
    const body = await readJson<Body>(request);
    if (!body || !isOutcome(body.sonuc)) return badRequest("Sonuç seçin.");
    const outcome = outcomeOf(body.sonuc);
    try {
      let lead = body.leadId ? await prisma.lead.findFirst({ where: { id: body.leadId, tenantId: ctx.tenantId } }) : null;
      if (!lead) {
        // Listede olmayan, elle yazılmış numara
        const phone = normalizePhone(body.manual?.phone ?? "", "TR");
        if (!phone) return badRequest("Telefon numarası geçersiz.");
        const placeId = `manual:${phone}`;
        lead = await prisma.lead.findFirst({ where: { tenantId: ctx.tenantId, OR: [{ placeId }, { phone }] } })
          ?? await prisma.lead.create({
            data: {
              tenantId: ctx.tenantId, placeId, phone,
              name: clip(body.manual?.name, 200) || phone,
              city: clip(body.manual?.city, 100), district: clip(body.manual?.district, 100),
            },
          });
      }

      const stamp = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
      const extra: string[] = [];
      const data: { status: string; notes: string; phone?: string } = { status: outcome.status, notes: lead.notes };

      // Müşteri başka bir WhatsApp numarası verdiyse takip o numaraya gitsin
      const wa = normalizePhone(clip(body.whatsapp, 40), "TR");
      if (wa && wa !== lead.phone && isWhatsAppCapablePhone(wa)) {
        extra.push(`önceki numara ${lead.phone}`);
        data.phone = wa;
      }
      const yetkili = clip(body.yetkili, 80), geri = clip(body.geriArama, 80);
      const line = [
        `${CALL_MARK} ${stamp} · ${outcome.label}`,
        yetkili && `görüşülen: ${yetkili}`,
        geri && `geri ara: ${geri}`,
        ...extra,
      ].filter(Boolean).join(" · ") + (clip(body.ozet, 600) ? ` — ${clip(body.ozet, 600)}` : "");
      data.notes = [line, lead.notes].filter(Boolean).join("\n").slice(0, 8000);

      const updated = await prisma.lead.update({ where: { id: lead.id }, data });
      await prisma.auditLog.create({
        data: {
          actorId: ctx.userId, actorEmail: ctx.email, tenantId: ctx.tenantId, action: "ai_arama",
          detail: JSON.stringify({
            leadId: lead.id, isletme: lead.name, sonuc: outcome.value, maliyet: Number(body.maliyet) || 0,
            konusma: clip(body.konusma, 8000),
          }),
        },
      });

      // Takip mesajı mevcut WhatsApp kuyruğuna onay bekleyen iş olarak düşer
      let queued = false, queueNote = "";
      const msg = clip(body.takipMesaji, 1500);
      if (body.kuyruga && msg) {
        const open = await prisma.outreachJob.findFirst({
          where: { tenantId: ctx.tenantId, leadId: lead.id, status: { in: ["pending", "queued", "sending"] } },
        });
        if (updated.status === "ilgilenmiyor") queueNote = "İlgilenmeyen müşteriye mesaj kuyruğa alınmadı.";
        else if (!isWhatsAppCapablePhone(updated.phone)) queueNote = "Numara WhatsApp'a uygun değil (sabit hat). Müşteriden cep numarası al.";
        else if (open) queueNote = "Bu müşteri için zaten bekleyen bir mesaj var.";
        else {
          await prisma.outreachJob.create({
            data: { tenantId: ctx.tenantId, leadId: lead.id, message: msg, status: "pending", channel: "whatsapp" },
          });
          queued = true;
        }
      }
      bustStatsCache(ctx.tenantId);
      return NextResponse.json({ ok: true, leadId: lead.id, status: updated.status, queued, queueNote });
    } catch (err) {
      return databaseUnavailable(err);
    }
  });
}
