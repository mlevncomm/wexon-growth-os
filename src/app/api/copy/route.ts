import { NextResponse } from "next/server";
import { COPY_ANGLES, generateSalesCopy, type CopyAngle } from "@/lib/copy-ai";
import { copyWithPlaybook } from "@/lib/coach";
import { readJson } from "@/lib/http";
import { pingLlm } from "@/lib/llm";
import { getPlaybook, playbookIsActive } from "@/lib/playbook";
import { getSettings } from "@/lib/settings";
import { denyIfGuest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const [settings, playbook] = await Promise.all([getSettings(), getPlaybook()]);
  return NextResponse.json({
    angles: COPY_ANGLES,
    hasLlm: Boolean(settings.llmApiKey),
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
    playbookActive: playbookIsActive(playbook),
    playbook,
  });
}

export async function POST(request: Request) {
  const denied = await denyIfGuest();
  if (denied) return denied;
  const body = (await readJson<{ angle?: string; brief?: string; ping?: boolean }>(request)) ?? {};
  const settings = await getSettings();
  const playbook = await getPlaybook();
  const angle = (COPY_ANGLES.some((a) => a.id === body.angle) ? body.angle : "kirec") as CopyAngle;
  const brief = typeof body.brief === "string" ? body.brief : "";
  const local = generateSalesCopy(angle);

  if (body.ping) {
    if (!settings.llmApiKey) {
      return NextResponse.json({ error: "AI anahtarı yok" }, { status: 400 });
    }
    try {
      await pingLlm({
        apiKey: settings.llmApiKey,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
      });
      return NextResponse.json({ ok: true, source: "ai" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI bağlanamadı";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!settings.llmApiKey) {
    return NextResponse.json({ ...local, source: "local", playbookActive: playbookIsActive(playbook) });
  }

  try {
    const generated = await copyWithPlaybook({ angle, brief });
    if (!generated) {
      return NextResponse.json({ ...local, source: "local", playbookActive: playbookIsActive(playbook) });
    }
    return NextResponse.json({ ...generated, source: "ai", playbookActive: playbookIsActive(playbook) });
  } catch (err) {
    const warning = err instanceof Error ? err.message : "AI yanıt vermedi";
    return NextResponse.json({ ...local, source: "local", warning, playbookActive: playbookIsActive(playbook) });
  }
}
