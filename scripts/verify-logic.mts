import { normalizePhone, matchesPrefix, formatPhoneDisplay, phoneForWhatsApp } from "../src/lib/phone.ts";
import { renderTemplate } from "../src/lib/templates.ts";
import { englishQuery, parseQueries } from "../src/lib/sectors.ts";
import { resolveSearchLocations } from "../src/lib/search-scope.ts";
import { TURKEY_ZONES, WORLD_GROUPS, WORLD_HUBS, REGIONS, zoneFor, worldGroupFor } from "../src/lib/regions.ts";
import { parseCopyJson, sanitizeCopy, copyNeedsRewrite } from "../src/lib/llm.ts";
import { mergePlaybook, playbookIsActive, playbookToPrompt } from "../src/lib/playbook.ts";

let failed = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) return;
  failed += 1;
  console.error(`FAIL ${label}`, detail ?? "");
}

const phoneCases: Array<[string, string | null, string | undefined]> = [
  ["0532 111 22 33", "+905321112233", undefined],
  ["5321112233", "+905321112233", "TR"],
  ["+90 532 111 22 33", "+905321112233", undefined],
  ["905321112233", "+905321112233", "TR"],
  ["0216 330 11 22", "+902163301122", "TR"],
  ["abc", null, undefined],
  ["+971 50 123 4567", "+971501234567", "AE"],
  ["050 123 4567", "+971501234567", "AE"],
  ["020 7946 0958", "+442079460958", "GB"],
  ["(212) 555-0100", "+12125550100", "US"],
  ["+1 212 555 0100", "+12125550100", "DE"],
  ["0532 111 22 33", null, ""],
  ["5321112233", null, ""],
  ["971501234567", "+971501234567", ""],
];

for (const [input, expected, region] of phoneCases) {
  const got = normalizePhone(input, region);
  check(got === expected, `phone ${input} [${region ?? "default"}]`, `${got} expected ${expected}`);
}

check(formatPhoneDisplay("+905321112233") === "+90 532 111 22 33", "display TR");
check(formatPhoneDisplay("+971501234567") === "+971 501 234 567", "display AE", formatPhoneDisplay("+971501234567"));
check(phoneForWhatsApp("+905321112233") === "905321112233", "wa digits");
check(matchesPrefix("+905321112233", "0532"), "prefix 0532");

const msg = renderTemplate("Merhaba {ad} / {ilçe}", {
  name: "Test Klinik",
  address: "Moda",
  district: "Kadıköy",
  city: "İstanbul",
  phone: "+905321112233",
});
check(msg === "Merhaba Test Klinik / Kadıköy", "template", msg);

check(englishQuery("restoran") === "restaurant", "en restoran");
check(englishQuery("klinik") === "clinic", "en klinik");
check(englishQuery("custom xyz") === "custom xyz", "en passthrough");
check(JSON.stringify(parseQueries("restoran | otel | kafe")) === JSON.stringify(["restoran", "otel", "kafe"]), "parseQueries");

const istanbul = resolveSearchLocations("İstanbul", "Kadıköy");
check(istanbul.length === 1 && istanbul[0].regionCode === "TR" && istanbul[0].district === "Kadıköy", "loc Istanbul");

const turkey = resolveSearchLocations("Tüm Türkiye");
check(turkey.length > 40 && turkey.every((l) => l.regionCode === "TR"), "loc all TR", turkey.length);

const world = resolveSearchLocations("Tüm dünya");
check(world.length === WORLD_HUBS.length, "loc all world", world.length);
check(world.some((l) => l.city === "Dubai" && l.regionCode === "AE" && l.languageCode === "en"), "loc Dubai in world");

const marmara = resolveSearchLocations("Bölge: Marmara");
const zone = zoneFor("Marmara");
check(marmara.length === (zone?.cities.length ?? -1), "loc Marmara size");
check(marmara.every((l) => l.regionCode === "TR"), "loc Marmara TR");

const gcc = resolveSearchLocations("Dünya: Körfez & MENA");
const group = worldGroupFor("Körfez & MENA");
check(gcc.length === (group?.cities.length ?? -1), "loc GCC size");
check(gcc.some((l) => l.city === "Dubai" && l.regionCode === "AE"), "loc GCC Dubai");

const unknown = resolveSearchLocations("Nairobi");
check(unknown.length === 1 && unknown[0].regionCode === "" && unknown[0].languageCode === "en", "loc unknown city");

check(Boolean(zoneFor("ege") && worldGroupFor("europe")), "zone/group id lookup");
check(TURKEY_ZONES.every((z) => z.cities.length > 0), "zones filled");
check(WORLD_GROUPS.every((g) => g.cities.length > 0), "world groups filled");

const regionCities = new Set(REGIONS.map((r) => r.city));
for (const z of TURKEY_ZONES) {
  for (const c of z.cities) {
    check(regionCities.has(c), `zone city missing ${c}`);
  }
}
const hubCities = new Set(WORLD_HUBS.map((h) => h.city));
for (const g of WORLD_GROUPS) {
  for (const c of g.cities) {
    check(hubCities.has(c), `hub missing ${c}`);
  }
}

const parsed = parseCopyJson('```json\n{"name":"Kireç","body":"Merhaba {ad}, {ilçe} için bakabilir miyiz?"}\n```');
check(parsed?.name === "Kireç" && Boolean(parsed?.body.includes("{ad}")), "parse copy json");
const sanitized = sanitizeCopy({ name: "x", body: "Kısa teklif." }, "kirec");
check(sanitized.body.includes("{ad}"), "sanitize injects ad");

const merged = mergePlaybook(
  { tone: "nazik", rules: "kısa", forbidden: "ucuz", offer: "", cta: "keşif" },
  { tone: "_keep", rules: "2 cümle", forbidden: "", offer: "kurulum", cta: "aynı" },
);
check(merged.tone === "nazik" && merged.rules === "2 cümle" && merged.offer === "kurulum" && merged.cta === "keşif", "merge playbook");
check(playbookIsActive(merged), "playbook active");
check(playbookToPrompt(merged).includes("Yasak"), "playbook prompt");
check(copyNeedsRewrite("Merhaba, ucuz cihaz!!!", merged), "rewrite spam");
check(!copyNeedsRewrite("Merhaba {ad}, {ilçe} için keşif ayarlayabilir miyiz?", merged), "rewrite ok");

if (failed) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("logic OK");
