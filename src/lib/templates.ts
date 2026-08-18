import type { Lead } from "@prisma/client";

export function renderTemplate(
  body: string,
  lead: Pick<Lead, "name" | "address" | "district" | "city" | "phone">,
): string {
  return body
    .replaceAll("{ad}", lead.name)
    .replaceAll("{ilçe}", lead.district || "")
    .replaceAll("{il}", lead.city || "")
    .replaceAll("{adres}", lead.address || "")
    .replaceAll("{telefon}", lead.phone || "");
}
