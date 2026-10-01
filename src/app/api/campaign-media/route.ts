import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 16 * 1024 * 1024;

export async function POST(request: Request) {
  return withTenant(async () => {
    const settings = await getSettings();
    if (!settings.waCloudToken || !settings.waPhoneNumberId) {
      return NextResponse.json({ error: "Dosya yüklemek için önce WhatsApp Cloud token ve Phone number ID kaydedilmelidir." }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Görsel veya video seçin." }, { status: 400 });
    }
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!type) return NextResponse.json({ error: "Yalnızca görsel veya video yüklenebilir." }, { status: 400 });
    const limit = type === "image" ? IMAGE_MAX : VIDEO_MAX;
    if (file.size > limit) {
      return NextResponse.json(
        { error: `${type === "image" ? "Görsel" : "Video"} en fazla ${limit / 1024 / 1024} MB olabilir.` },
        { status: 413 },
      );
    }

    const upload = new FormData();
    upload.set("messaging_product", "whatsapp");
    upload.set("file", file, file.name);
    const res = await fetch(`https://graph.facebook.com/v21.0/${settings.waPhoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.waCloudToken}` },
      body: upload,
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      return NextResponse.json({ error: json.error?.message || "Medya Meta'ya yüklenemedi." }, { status: 400 });
    }

    await updateSettings({
      campaignMediaEnabled: true,
      campaignMediaType: type,
      campaignMediaId: json.id,
      campaignMediaUrl: "",
      campaignMediaName: file.name.slice(0, 160),
    });
    return NextResponse.json({ ok: true, type, name: file.name, id: json.id });
  });
}

export async function DELETE() {
  return withTenant(async () => {
    await updateSettings({
      campaignMediaEnabled: false,
      campaignMediaType: "",
      campaignMediaId: "",
      campaignMediaUrl: "",
      campaignMediaName: "",
    });
    return NextResponse.json({ ok: true });
  });
}
