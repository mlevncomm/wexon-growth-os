import { phoneForWhatsApp } from "../phone";
import { getSettings } from "../settings";

export async function sendCloudMessage(e164: string, text: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.waCloudToken || !settings.waPhoneNumberId) {
    throw new Error("Cloud API bilgileri eksik");
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${settings.waPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.waCloudToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneForWhatsApp(e164),
        type: "text",
        text: { preview_url: false, body: text },
      }),
    },
  );

  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Cloud API ${res.status}`);
  }
}

export async function cloudConfigured(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s.waCloudToken && s.waPhoneNumberId);
}
