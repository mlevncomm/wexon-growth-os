import { matchesPrefix, normalizePhone } from "./phone";
import { getSettings } from "./settings";

export type PlaceHit = {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
};

type PlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

const SEARCH_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.location",
  "nextPageToken",
].join(",");

const DETAIL_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "location",
].join(",");

async function placesFetch(
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        (init?.headers as Record<string, string> | undefined)?.["X-Goog-FieldMask"] ??
        SEARCH_MASK,
      ...(init?.headers ?? {}),
    },
  });
}

function mapPlace(
  p: NonNullable<PlacesSearchResponse["places"]>[number],
  regionCode?: string,
): PlaceHit | null {
  const placeId = p.id;
  const name = p.displayName?.text?.trim();
  if (!placeId || !name) return null;
  const phone =
    normalizePhone(p.internationalPhoneNumber, regionCode) ||
    normalizePhone(p.nationalPhoneNumber, regionCode) ||
    "";
  return {
    placeId,
    name,
    address: p.formattedAddress ?? "",
    phone,
    website: p.websiteUri ?? "",
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  };
}

async function fetchDetails(
  apiKey: string,
  placeId: string,
  languageCode: string,
  regionCode?: string,
): Promise<PlaceHit | null> {
  const res = await placesFetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(languageCode)}`,
    apiKey,
    { headers: { "X-Goog-FieldMask": DETAIL_MASK } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as NonNullable<PlacesSearchResponse["places"]>[number];
  return mapPlace(json, regionCode);
}

export async function searchPlaces(opts: {
  query: string;
  city: string;
  district?: string;
  targetCount: number;
  minRating: number;
  requirePhone: boolean;
  phonePrefix: string;
  regionCode?: string;
  languageCode?: string;
  onHit?: (hit: PlaceHit) => Promise<void> | void;
}): Promise<{ hits: PlaceHit[]; skipped: number }> {
  const settings = await getSettings();
  const apiKey = settings.googlePlacesApiKey;
  if (!apiKey) {
    throw new Error("Google Places API anahtarı yok. Ayarlar ekranından ekleyin.");
  }

  const textQuery = [opts.query, opts.district, opts.city].filter(Boolean).join(" ").trim();
  const hits: PlaceHit[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let pageToken: string | undefined;

  while (hits.length < opts.targetCount) {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: opts.languageCode ?? "tr",
      pageSize: 20,
    };
    if (opts.regionCode) body.regionCode = opts.regionCode;
    if (pageToken) body.pageToken = pageToken;

    const res = await placesFetch(
      "https://places.googleapis.com/v1/places:searchText",
      apiKey,
      { method: "POST", body: JSON.stringify(body) },
    );
    const json = (await res.json()) as PlacesSearchResponse;
    if (!res.ok) {
      const message = json.error?.message || `Places API ${res.status}`;
      if (shouldUseLegacy(message, res.status)) {
        return searchPlacesLegacy(apiKey, opts, textQuery);
      }
      throw new Error(placesHelp(message));
    }

    const places = json.places ?? [];
    if (places.length === 0) break;

    for (const raw of places) {
      if (hits.length >= opts.targetCount) break;
      let hit = mapPlace(raw, opts.regionCode);
      if (!hit || seen.has(hit.placeId)) continue;

      if (!hit.phone) {
        const detailed = await fetchDetails(
          apiKey,
          hit.placeId,
          opts.languageCode ?? "tr",
          opts.regionCode,
        );
        if (detailed) hit = { ...hit, ...detailed, placeId: hit.placeId };
      }

      if (opts.minRating > 0 && (hit.rating == null || hit.rating < opts.minRating)) {
        skipped += 1;
        continue;
      }
      if (opts.requirePhone && !hit.phone) {
        skipped += 1;
        continue;
      }
      if (hit.phone && !matchesPrefix(hit.phone, opts.phonePrefix)) {
        skipped += 1;
        continue;
      }

      seen.add(hit.placeId);
      hits.push(hit);
      await opts.onHit?.(hit);
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
    await new Promise((r) => setTimeout(r, 1200));
  }

  return { hits, skipped };
}

function shouldUseLegacy(message: string, status: number) {
  return (
    status === 403 ||
    status === 404 ||
    /has not been used|PERMISSION_DENIED|Places API \(New\)|SERVICE_DISABLED/i.test(message)
  );
}

function placesHelp(detail: string) {
  return (
    "Google Places kapalı veya anahtar yetkisiz. Cloud Console’da hem Places API (New) hem Places API’yi açıp birkaç dakika bekleyin. " +
    detail
  );
}

type LegacySearch = {
  status?: string;
  error_message?: string;
  next_page_token?: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

type LegacyDetails = {
  status?: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  };
};

async function searchPlacesLegacy(
  apiKey: string,
  opts: {
    query: string;
    city: string;
    district?: string;
    targetCount: number;
    minRating: number;
    requirePhone: boolean;
    phonePrefix: string;
    regionCode?: string;
    languageCode?: string;
    onHit?: (hit: PlaceHit) => Promise<void> | void;
  },
  textQuery: string,
): Promise<{ hits: PlaceHit[]; skipped: number }> {
  const hits: PlaceHit[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let pageToken: string | undefined;

  while (hits.length < opts.targetCount) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", textQuery);
    url.searchParams.set("language", opts.languageCode ?? "tr");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pagetoken", pageToken);

    const res = await fetch(url);
    const json = (await res.json()) as LegacySearch;
    if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(placesHelp(json.error_message || json.status));
    }
    const rows = json.results ?? [];
    if (rows.length === 0) break;

    for (const raw of rows) {
      if (hits.length >= opts.targetCount) break;
      const placeId = raw.place_id;
      const name = raw.name?.trim();
      if (!placeId || !name || seen.has(placeId)) continue;

      let hit: PlaceHit = {
        placeId,
        name,
        address: raw.formatted_address ?? "",
        phone: "",
        website: "",
        rating: typeof raw.rating === "number" ? raw.rating : null,
        reviewCount: typeof raw.user_ratings_total === "number" ? raw.user_ratings_total : null,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        lat: raw.geometry?.location?.lat ?? null,
        lng: raw.geometry?.location?.lng ?? null,
      };

      const detailed = await fetchLegacyDetails(apiKey, placeId, opts.languageCode ?? "tr", opts.regionCode);
      if (detailed) hit = { ...hit, ...detailed, placeId };

      if (opts.minRating > 0 && (hit.rating == null || hit.rating < opts.minRating)) {
        skipped += 1;
        continue;
      }
      if (opts.requirePhone && !hit.phone) {
        skipped += 1;
        continue;
      }
      if (hit.phone && !matchesPrefix(hit.phone, opts.phonePrefix)) {
        skipped += 1;
        continue;
      }

      seen.add(placeId);
      hits.push(hit);
      await opts.onHit?.(hit);
    }

    if (!json.next_page_token) break;
    pageToken = json.next_page_token;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { hits, skipped };
}

async function fetchLegacyDetails(
  apiKey: string,
  placeId: string,
  language: string,
  regionCode?: string,
): Promise<PlaceHit | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("language", language);
  url.searchParams.set("key", apiKey);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,url,geometry",
  );
  const res = await fetch(url);
  const json = (await res.json()) as LegacyDetails;
  const p = json.result;
  const id = p?.place_id;
  const name = p?.name;
  if (json.status !== "OK" || !id || !name) return null;
  return {
    placeId: id,
    name,
    address: p.formatted_address ?? "",
    phone:
      normalizePhone(p.international_phone_number, regionCode) ||
      normalizePhone(p.formatted_phone_number, regionCode) ||
      "",
    website: p.website ?? "",
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewCount: typeof p.user_ratings_total === "number" ? p.user_ratings_total : null,
    mapsUrl: p.url ?? `https://www.google.com/maps/place/?q=place_id:${id}`,
    lat: p.geometry?.location?.lat ?? null,
    lng: p.geometry?.location?.lng ?? null,
  };
}
