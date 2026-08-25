"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dialCodeFor, formatPhoneDisplay } from "@/lib/phone";
import { REGIONS, TURKEY_ZONES, WORLD_GROUPS, WORLD_HUBS, hubFor } from "@/lib/regions";
import { ChipStrip } from "@/components/ChipStrip";
import { useToast } from "@/components/Toast";

type Region = { city: string; districts: string[] };
type Lead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  mapsUrl: string;
};
type Campaign = {
  id: string;
  status: string;
  foundCount: number;
  skippedCount: number;
  targetCount: number;
  error: string | null;
  city?: string;
  district?: string;
  query?: string;
  createdAt?: string;
  leads?: Lead[];
};
type Scope = "city" | "zone" | "turkey" | "hub" | "worldGroup" | "world";
type SectorGroup = { id: string; label: string; items: { label: string; query: string }[] };
type SectorPreset = { id: string; label: string; hint: string; queries: string[] };

const PINNED_CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Kocaeli", "Gaziantep"];
const COUNT_PRESETS = [10, 20, 40, 60];
const RATING_PRESETS = [
  { label: "Hepsi", value: 0 },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

export default function AraPage() {
  const toast = useToast();
  const [regions] = useState<Region[]>(REGIONS);
  const [showAllCities, setShowAllCities] = useState(false);
  const [scope, setScope] = useState<Scope>("city");
  const [selectedQueries, setSelectedQueries] = useState<string[]>(["restoran"]);
  const [customQuery, setCustomQuery] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [cityFilter, setCityFilter] = useState("");
  const [district, setDistrict] = useState("Kadıköy");
  const [zone, setZone] = useState("Marmara");
  const [worldGroup, setWorldGroup] = useState("Körfez & MENA");
  const [hub, setHub] = useState("Dubai");
  const [hubFilter, setHubFilter] = useState("");
  const [targetCount, setTargetCount] = useState(20);
  const [minRating, setMinRating] = useState(0);
  const [requirePhone, setRequirePhone] = useState(true);
  const [phonePrefix, setPhonePrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Campaign[]>([]);
  const [sectorGroups, setSectorGroups] = useState<SectorGroup[]>([]);
  const [sectorPresets, setSectorPresets] = useState<SectorPreset[]>([]);
  const [sectorFilter, setSectorFilter] = useState("");

  const districts = useMemo(
    () => regions.find((r) => r.city === city)?.districts ?? [],
    [regions, city],
  );

  const filteredCities = useMemo(() => {
    const q = cityFilter.trim().toLocaleLowerCase("tr");
    if (!q) return regions;
    return regions.filter((r) => r.city.toLocaleLowerCase("tr").includes(q));
  }, [regions, cityFilter]);

  const visibleCities = useMemo(() => {
    if (cityFilter.trim() || showAllCities) return filteredCities;
    const pinned = filteredCities.filter((r) => PINNED_CITIES.includes(r.city) || r.city === city);
    return pinned.length ? pinned : filteredCities.slice(0, 8);
  }, [filteredCities, cityFilter, showAllCities, city]);

  const filteredHubs = useMemo(() => {
    const q = hubFilter.trim().toLowerCase();
    if (!q) return WORLD_HUBS;
    return WORLD_HUBS.filter((h) => h.city.toLowerCase().includes(q));
  }, [hubFilter]);

  useEffect(() => {
    void fetch("/api/sectors", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { vertical?: string; groups?: SectorGroup[]; presets?: SectorPreset[] }) => {
        const groups = Array.isArray(json.groups) ? json.groups : [];
        const presets = Array.isArray(json.presets) ? json.presets : [];
        setSectorGroups(groups);
        setSectorPresets(presets);
        const allowed = new Set(groups.flatMap((g) => g.items.map((i) => i.query)));
        const first = groups[0]?.items[0]?.query;
        const seeded = json.vertical === "software" || json.vertical === "yks";
        setSelectedQueries((prev) => {
          const pack = presets[0]?.queries.filter((q) => allowed.has(q)) ?? [];
          if (seeded && pack.length && prev.length === 1 && prev[0] === "restoran") return pack;
          const keep = prev.filter((q) => allowed.has(q));
          if (keep.length) return keep;
          if (pack.length) return pack;
          return first ? [first] : [];
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((rows: Campaign[]) => {
        if (Array.isArray(rows)) setRecent(rows);
      })
      .catch(() => undefined);
  }, [campaign?.status, campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let alive = true;
    const poll = async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" });
      if (!res.ok || !alive) return;
      const next = (await res.json()) as Campaign;
      setCampaign(next);
      if (next.status === "done" || next.status === "error" || next.status === "cancelled") setBusy(false);
    };
    void poll();
    const t = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [campaignId]);

  const visibleSectorGroups = useMemo(() => {
    const q = sectorFilter.trim().toLocaleLowerCase("tr");
    if (!q) return sectorGroups;
    return sectorGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLocaleLowerCase("tr").includes(q) || i.query.toLocaleLowerCase("tr").includes(q),
        ),
      }))
      .filter((g) => g.items.length);
  }, [sectorGroups, sectorFilter]);

  function toggleQuery(query: string) {
    setSelectedQueries((prev) =>
      prev.includes(query) ? prev.filter((q) => q !== query) : [...prev, query],
    );
  }

  function toggleGroup(id: string) {
    const items = visibleSectorGroups.find((g) => g.id === id)?.items ?? [];
    const keys = items.map((i) => i.query);
    setSelectedQueries((prev) => {
      const allOn = keys.every((k) => prev.includes(k));
      if (allOn) return prev.filter((q) => !keys.includes(q));
      return [...new Set([...prev, ...keys])];
    });
  }

  function applyPreset(preset: SectorPreset) {
    setSelectedQueries(preset.queries);
    setSectorFilter("");
  }

  const queries = useMemo(() => {
    const extra = customQuery.trim();
    const list = extra ? [...selectedQueries, extra] : selectedQueries;
    return [...new Set(list.map((q) => q.trim()).filter(Boolean))];
  }, [selectedQueries, customQuery]);

  const queryLabel = useMemo(() => {
    const map = new Map(sectorGroups.flatMap((g) => g.items.map((i) => [i.query, i.label] as const)));
    return (query: string) => map.get(query) ?? query;
  }, [sectorGroups]);

  const trPhone = scope === "city" || scope === "zone" || scope === "turkey";
  const activeDial = trPhone ? "90" : scope === "hub" ? dialCodeFor(hubFor(hub)?.regionCode) : null;

  async function startSearch() {
    setError("");
    if (!queries.length) {
      setError("En az bir sektör veya kelime seçin.");
      return;
    }
    setBusy(true);
    setCampaign(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries,
        city: scope === "city" ? city : scope === "hub" ? hub : undefined,
        district: scope === "city" ? district : "",
        scope,
        zone: scope === "zone" ? zone : undefined,
        worldGroup: scope === "worldGroup" ? worldGroup : undefined,
        targetCount,
        minRating,
        requirePhone,
        phonePrefix: trPhone ? phonePrefix : "",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(json.error || "Keşif başlatılamadı");
      toast.push(json.error || "Keşif başlatılamadı", "bad");
      return;
    }
    setCampaign(json);
    setCampaignId(json.id);
  }

  async function stopSearch() {
    if (!campaignId) return;
    await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    toast.push("Keşif durduruldu");
    setBusy(false);
  }

  const found = campaign?.foundCount ?? 0;
  const target = campaign?.targetCount ?? targetCount;
  const foundPct = target ? Math.min(100, Math.round((found / target) * 100)) : 0;
  const rows = campaign?.leads ?? [];

  return (
    <div>
      <div className="page-kicker">Keşif</div>
      <h1 className="page-title">Alıcı işletme bul</h1>
      <p className="page-copy">
        İl, bölge veya dünya şehri seçin; birden fazla sektörü birlikte tarayın. Hedef dolunca durur, aynı işletme ikinci kez yazılmaz.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="field">
          <span>Kapsam</span>
          <ChipStrip>
            {(
              [
                ["city", "İl / ilçe"],
                ["zone", "Bölge"],
                ["turkey", "Tüm Türkiye"],
                ["hub", "Dünya şehri"],
                ["worldGroup", "Dünya bölgesi"],
                ["world", "Tüm dünya"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip${scope === id ? " on" : ""}`}
                onClick={() => setScope(id)}
              >
                {label}
              </button>
            ))}
          </ChipStrip>
        </div>

        {scope === "city" ? (
          <>
            <label className="field" style={{ marginTop: 16 }}>
              <span>İl ara</span>
              <input value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} placeholder="İl adı yazın" />
            </label>
            <div className="field" style={{ marginTop: 12 }}>
              <span>İl · {filteredCities.length}</span>
              <ChipStrip wrap>
                {visibleCities.map((r) => (
                  <button
                    key={r.city}
                    type="button"
                    className={`chip${city === r.city ? " on" : ""}`}
                    onClick={() => {
                      setCity(r.city);
                      setDistrict(r.districts[0] ?? "");
                    }}
                  >
                    {r.city}
                  </button>
                ))}
                {!cityFilter.trim() && !showAllCities && filteredCities.length > visibleCities.length ? (
                  <button type="button" className="chip" onClick={() => setShowAllCities(true)}>
                    Tüm iller · {filteredCities.length}
                  </button>
                ) : null}
              </ChipStrip>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <span>İlçe</span>
              <ChipStrip>
                <button type="button" className={`chip${district === "" ? " on" : ""}`} onClick={() => setDistrict("")}>
                  Tüm il
                </button>
                {districts.map((d) => (
                  <button key={d} type="button" className={`chip${district === d ? " on" : ""}`} onClick={() => setDistrict(d)}>
                    {d}
                  </button>
                ))}
              </ChipStrip>
            </div>
          </>
        ) : null}

        {scope === "zone" ? (
          <div className="field" style={{ marginTop: 16 }}>
            <span>Türkiye bölgesi</span>
            <ChipStrip>
              {TURKEY_ZONES.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  className={`chip${zone === z.label ? " on" : ""}`}
                  onClick={() => setZone(z.label)}
                >
                  {z.label} · {z.cities.length}
                </button>
              ))}
            </ChipStrip>
            <p className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
              {TURKEY_ZONES.find((z) => z.label === zone)?.cities.join(", ")}
            </p>
          </div>
        ) : null}

        {scope === "hub" ? (
          <>
            <label className="field" style={{ marginTop: 16 }}>
              <span>Şehir ara</span>
              <input value={hubFilter} onChange={(e) => setHubFilter(e.target.value)} placeholder="Dubai, London, New York" />
            </label>
            <div className="field" style={{ marginTop: 12 }}>
              <span>Dünya şehri</span>
              <ChipStrip>
                {hubFilter.trim() && !WORLD_HUBS.some((h) => h.city.toLowerCase() === hubFilter.trim().toLowerCase()) ? (
                  <button type="button" className={`chip${hub === hubFilter.trim() ? " on" : ""}`} onClick={() => setHub(hubFilter.trim())}>
                    “{hubFilter.trim()}” kullan
                  </button>
                ) : null}
                {filteredHubs.map((h) => (
                  <button
                    key={`${h.city}-${h.regionCode}`}
                    type="button"
                    className={`chip${hub === h.city ? " on" : ""}`}
                    onClick={() => setHub(h.city)}
                  >
                    {h.city}
                  </button>
                ))}
              </ChipStrip>
            </div>
          </>
        ) : null}

        {scope === "worldGroup" ? (
          <div className="field" style={{ marginTop: 16 }}>
            <span>Dünya bölgesi</span>
            <ChipStrip>
              {WORLD_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`chip${worldGroup === g.label ? " on" : ""}`}
                  onClick={() => setWorldGroup(g.label)}
                >
                  {g.label} · {g.cities.length}
                </button>
              ))}
            </ChipStrip>
            <p className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
              {WORLD_GROUPS.find((g) => g.label === worldGroup)?.cities.join(", ")}
            </p>
          </div>
        ) : null}

        {scope === "turkey" || scope === "world" ? (
          <p className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>
            {scope === "turkey"
              ? "Listedeki iller sırayla taranır; hedef adede ulaşınca durur."
              : "Hub şehirler sırayla taranır. Spam tarama değil; tavan en fazla 60 kayıt."}
          </p>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="panel-head" style={{ marginBottom: 8 }}>
          <div>
            <div className="page-kicker">Alıcı sektör</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>
              {selectedQueries.length ? `${selectedQueries.length} sektör seçili` : "Kimleri tarayacaksınız?"}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedQueries([])} disabled={!selectedQueries.length}>
            Temizle
          </button>
        </div>
        {sectorPresets.length ? (
          <div className="field" style={{ marginBottom: 12 }}>
            <span>Hazır paket</span>
            <ChipStrip wrap>
              {sectorPresets.map((p) => {
                const on = p.queries.length > 0 && p.queries.every((q) => selectedQueries.includes(q));
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    title={p.hint}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </ChipStrip>
          </div>
        ) : null}
        <label className="field">
          <span>Sektör ara</span>
          <input
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            placeholder="ör. klinik, ajans, otel"
          />
        </label>
        {selectedQueries.length ? (
          <div className="sector-selected">
            {selectedQueries.map((q) => (
              <button key={q} type="button" className="chip on" onClick={() => toggleQuery(q)}>
                {queryLabel(q)} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
            Paket seçin veya aşağıdaki etiketlerden ekleyin. Ek kelime ayrı durur.
          </p>
        )}
        <div className="sector-groups" style={{ marginTop: 14 }}>
          {visibleSectorGroups.map((g) => {
            const allOn = g.items.length > 0 && g.items.every((i) => selectedQueries.includes(i.query));
            const onCount = g.items.filter((i) => selectedQueries.includes(i.query)).length;
            return (
              <div key={g.id} className={`sector-group${onCount ? " is-on" : ""}`}>
                <div className="sector-group-head">
                  <strong>
                    {g.label}
                    <span className="muted" style={{ fontWeight: 600, marginLeft: 8 }}>
                      {onCount}/{g.items.length}
                    </span>
                  </strong>
                  <button type="button" onClick={() => toggleGroup(g.id)}>
                    {allOn ? "Grubu kaldır" : "Grubun tümü"}
                  </button>
                </div>
                <ChipStrip wrap>
                  {g.items.map((s) => (
                    <button
                      key={s.query}
                      type="button"
                      className={`chip${selectedQueries.includes(s.query) ? " on" : ""}`}
                      onClick={() => toggleQuery(s.query)}
                    >
                      {s.label}
                    </button>
                  ))}
                </ChipStrip>
              </div>
            );
          })}
        </div>
        {sectorFilter.trim() && visibleSectorGroups.length === 0 ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Eşleşen sektör yok. Aşağıya ek kelime yazabilirsiniz.
          </p>
        ) : null}
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          {queries.length ? `Tarama: ${queries.map(queryLabel).join(" · ")}` : "Sektör seçin veya aşağıya kelime yazın."}
        </p>
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <label className="field">
          <span>Ek kelime</span>
          <input value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="ör. endüstriyel mutfak" />
        </label>
        <div className="field">
          <span>Adet</span>
          <ChipStrip>
            {COUNT_PRESETS.map((n) => (
              <button key={n} type="button" className={`chip${targetCount === n ? " on" : ""}`} onClick={() => setTargetCount(n)}>
                {n}
              </button>
            ))}
          </ChipStrip>
        </div>
        <div className="field">
          <span>Min. puan</span>
          <ChipStrip>
            {RATING_PRESETS.map((r) => (
              <button
                key={r.label}
                type="button"
                className={`chip${minRating === r.value ? " on" : ""}`}
                onClick={() => setMinRating(r.value)}
              >
                {r.label}
              </button>
            ))}
          </ChipStrip>
        </div>
        <label className="field">
          <span>Telefon öneki</span>
          <input
            value={phonePrefix}
            onChange={(e) => setPhonePrefix(e.target.value)}
            placeholder={trPhone ? "0532" : activeDial ? `+${activeDial}` : "ülke kodu otomatik"}
            disabled={!trPhone}
          />
        </label>
      </div>

      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        {activeDial
          ? `Telefonlar +${activeDial} ile kaydedilir.${activeDial === "90" ? " +90 yalnızca Türkiye." : ""}`
          : "Telefonlar şehirdeki ülke koduyla kaydedilir (Dubai +971, Londra +44). +90 yalnızca Türkiye."}
      </p>

      <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, minHeight: 44 }}>
        <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} />
        Telefonu olmayanları alma
      </label>

      <div className="kesif-bar">
        <button className="btn btn-wexon" type="button" disabled={busy} onClick={() => void startSearch()}>
          {busy ? "Keşif sürüyor…" : "Keşif başlat"}
        </button>
        {busy ? (
          <button className="btn btn-ghost" type="button" onClick={() => void stopSearch()}>
            Durdur
          </button>
        ) : null}
        {campaign ? (
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              {campaign.foundCount}/{campaign.targetCount} bulundu
              {campaign.city ? ` · ${campaign.city}` : ""}
              {campaign.skippedCount ? ` · ${campaign.skippedCount} elendi` : ""}
              {campaign.status === "cancelled" ? " · durduruldu" : ""}
              {campaign.status === "done" ? " · bitti" : ""}
            </div>
            <div className="progress"><span style={{ width: `${foundPct}%` }} /></div>
          </div>
        ) : null}
      </div>

      {campaign?.status === "done" && found > 0 ? (
        <p className="notice" style={{ marginTop: 16 }}>
          {found} işletme eklendi.{" "}
          <Link href="/musteriler">Müşterilere git</Link>
          {" · "}
          <Link href="/musteriler?queue=1">Kuyruğu aç</Link>
        </p>
      ) : null}
      {error ? <p className="error-box" style={{ marginTop: 16 }}>{error}</p> : null}
      {campaign?.error ? (
        <p className="error-box" style={{ marginTop: 16 }}>
          {campaign.error}{" "}
          <a href="/kilavuz" style={{ textDecoration: "underline" }}>Kılavuz</a>
        </p>
      ) : null}

      {recent.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="flow-head">
            <div>
              <div className="page-kicker">Geçmiş</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>Son taramalar</h2>
            </div>
          </div>
          <div className="activity-row act-head">
            <span>Arama</span>
            <span>Yer</span>
            <span>Durum</span>
            <span>Bulunan</span>
          </div>
          {recent.slice(0, 6).map((row) => (
            <button
              key={row.id}
              type="button"
              className="activity-row"
              style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer" }}
              onClick={() => {
                setCampaignId(row.id);
                setCampaign(row);
              }}
            >
              <strong>{row.query || "Tarama"}</strong>
              <span className="muted">{[row.district, row.city].filter(Boolean).join(" · ") || "—"}</span>
              <span className={`pill ${row.status === "done" ? "ok" : row.status === "error" ? "warn" : "mute"}`}>
                {row.status === "done" ? "bitti" : row.status === "error" ? "hata" : row.status === "cancelled" ? "durdu" : "çalışıyor"}
              </span>
              <span className="muted">{row.foundCount}/{row.targetCount}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="data">
          <thead>
            <tr>
              <th>İşletme</th>
              <th>Adres</th>
              <th>Telefon</th>
              <th>Puan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty">
                    <strong>{busy ? "Keşif taranıyor" : "Sonuç yok"}</strong>
                    {busy ? "Places cevap verdikçe satırlar belirir." : "Kapsamı seçip keşif başlat."}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div style={{ fontWeight: 650 }}>{lead.name}</div>
                    {lead.mapsUrl ? <a className="muted" href={lead.mapsUrl} target="_blank" rel="noreferrer">Maps</a> : null}
                  </td>
                  <td>{lead.address}</td>
                  <td>{lead.phone ? formatPhoneDisplay(lead.phone) : "—"}</td>
                  <td>{lead.rating ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="lead-cards" style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <div className="card empty">
            <strong>{busy ? "Keşif taranıyor" : "Sonuç yok"}</strong>
            {busy ? "Kayıtlar geliyor." : "Kapsamı seçip keşif başlat."}
          </div>
        ) : (
          rows.map((lead) => (
            <article key={lead.id} className="card lead-card">
              <strong>{lead.name}</strong>
              <span className="muted">{lead.address}</span>
              <span>{lead.phone ? formatPhoneDisplay(lead.phone) : "—"} · {lead.rating ?? "puan yok"}</span>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
