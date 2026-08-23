import { prisma } from "./prisma";
import { generateSalesCopy } from "./copy-ai";
import { searchPlaces } from "./places";
import { englishQuery, parseQueries } from "./sectors";
import { resolveSearchLocations } from "./search-scope";

const g = globalThis as unknown as { __gooleadsCampaigns?: Set<string> };

function running(): Set<string> {
  if (!g.__gooleadsCampaigns) g.__gooleadsCampaigns = new Set();
  return g.__gooleadsCampaigns;
}

export function startCampaignInBackground(id: string): void {
  const set = running();
  if (set.has(id)) return;
  set.add(id);
  void runCampaign(id).finally(() => set.delete(id));
}

export async function resumeStaleCampaign(): Promise<string | null> {
  const camp = await prisma.campaign.findFirst({
    where: {
      OR: [
        { status: "queued" },
        { status: "running", updatedAt: { lt: new Date(Date.now() - 90_000) } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!camp) return null;
  await runCampaign(camp.id);
  return camp.id;
}

function queryFor(query: string, languageCode: string): string {
  if (languageCode === "tr") return query;
  return englishQuery(query);
}

export async function runCampaign(id: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.status === "cancelled" || campaign.status === "done") return;

  const stale = new Date(Date.now() - 90_000);
  const claimed = await prisma.campaign.updateMany({
    where: {
      id,
      OR: [{ status: "queued" }, { status: "running", updatedAt: { lt: stale } }],
    },
    data: { status: "running", error: null },
  });
  if (claimed.count === 0) return;

  try {
    const queries = parseQueries(campaign.query);
    const locs = resolveSearchLocations(campaign.city, campaign.district);
    if (!locs.length || !queries.length) {
      throw new Error("Kapsam veya sektör boş.");
    }
    outer: for (const loc of locs) {
      for (const q of queries) {
        const fresh = await prisma.campaign.findUnique({ where: { id } });
        if (!fresh || fresh.status === "cancelled" || fresh.foundCount >= campaign.targetCount) break outer;

        const remaining = campaign.targetCount - fresh.foundCount;
        const { skipped } = await searchPlaces({
          query: queryFor(q, loc.languageCode),
          city: loc.city,
          district: loc.district,
          targetCount: remaining,
          minRating: campaign.minRating,
          requirePhone: campaign.requirePhone,
          phonePrefix: campaign.phonePrefix,
          regionCode: loc.regionCode,
          languageCode: loc.languageCode,
          onHit: async (hit) => {
          const existing = await prisma.lead.findUnique({
            where: { placeId: hit.placeId },
          });
          if (existing) {
            await prisma.campaign.update({
              where: { id },
              data: { skippedCount: { increment: 1 } },
            });
            return;
          }
          await prisma.lead.create({
            data: {
              placeId: hit.placeId,
              campaignId: id,
              name: hit.name,
              address: hit.address,
              phone: hit.phone,
              website: hit.website,
              rating: hit.rating,
              reviewCount: hit.reviewCount,
              mapsUrl: hit.mapsUrl,
              lat: hit.lat,
              lng: hit.lng,
              district: loc.district,
              city: loc.city,
              status: "yeni",
            },
          });
          await prisma.campaign.update({
            where: { id },
            data: { foundCount: { increment: 1 } },
          });
        },
      });
      await prisma.campaign.update({
        where: { id },
        data: { skippedCount: { increment: skipped } },
      });
      }
    }

    const latest = await prisma.campaign.findUnique({ where: { id } });
    if (latest?.status === "cancelled") return;

    await prisma.campaign.update({
      where: { id },
      data: { status: "done" },
    });
    const { bustStatsCache } = await import("./stats");
    bustStatsCache();
  } catch (err) {
    const latest = await prisma.campaign.findUnique({ where: { id } });
    if (latest?.status === "cancelled") return;
    await prisma.campaign.update({
      where: { id },
      data: {
        status: "error",
        error: err instanceof Error ? err.message : "Arama başarısız",
      },
    });
    const { bustStatsCache } = await import("./stats");
    bustStatsCache();
  }
}

const seedOnce = globalThis as unknown as { __wexonSeed?: Promise<void> };

export async function ensureSeed(): Promise<void> {
  if (!seedOnce.__wexonSeed) {
    seedOnce.__wexonSeed = (async () => {
      const needed = [
        generateSalesCopy("kirec"),
        generateSalesCopy("maliyet"),
        generateSalesCopy("hijyen"),
        generateSalesCopy("isletme"),
        generateSalesCopy("takip"),
      ];
      for (const t of needed) {
        const exists = await prisma.template.findFirst({ where: { name: t.name } });
        if (!exists) await prisma.template.create({ data: t });
      }
      if ((await prisma.template.count()) === 0) {
        await prisma.template.create({ data: generateSalesCopy("kirec") });
      }
      await prisma.appSettings.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
      });
    })().catch((err) => {
      seedOnce.__wexonSeed = undefined;
      throw err;
    });
  }
  await seedOnce.__wexonSeed;
}
