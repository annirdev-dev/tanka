import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, handleOptions, requireCronAuth } from "../_shared/cors.ts";
import { FUEL_TYPES, FuelType } from "../_shared/station.ts";

const API_BASE_URL = "https://api.apiaberta.pt/v1/fuel/stations";
const PAGE_LIMIT = 100;
// Free tier allows 60 requests/minute — spacing pages by 1.1s keeps a full
// per-fuel sync comfortably under that even accounting for network jitter.
const MIN_REQUEST_INTERVAL_MS = 1_100;
const UPSERT_CHUNK_SIZE = 500;

interface RawStationRow {
  station_id: number;
  name: string;
  brand: string;
  address: string;
  locality: string;
  municipality: string;
  district: string;
  postal_code: string;
  price_eur: number;
  location: { lat: number; lng: number };
  updated_at: string;
}

interface RawStationsResponse {
  meta: { page: number; limit: number; total: number; pages: number };
  data: RawStationRow[];
}

async function fetchAllPages(fuel: FuelType, apiKey: string): Promise<RawStationRow[]> {
  const rows: RawStationRow[] = [];
  let page = 1;
  let pages = 1;
  let lastRequestAt = 0;

  do {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    const url = new URL(API_BASE_URL);
    url.searchParams.set("fuel", fuel);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_LIMIT));

    const res = await fetch(url.toString(), { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API Aberta ${res.status} on fuel=${fuel} page=${page}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as RawStationsResponse;
    rows.push(...data.data);
    pages = data.meta.pages;
    page += 1;
  } while (page <= pages);

  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const forbidden = requireCronAuth(req);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const fuel = (url.searchParams.get("fuel") ?? "") as FuelType;
  if (!FUEL_TYPES.includes(fuel)) {
    return jsonResponse({ error: `fuel must be one of ${FUEL_TYPES.join(", ")}` }, { status: 400 });
  }

  const apiKey = Deno.env.get("API_ABERTA_KEY");
  if (!apiKey) return jsonResponse({ error: "API_ABERTA_KEY is not configured" }, { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rows = await fetchAllPages(fuel, apiKey);

    // Existing prices for this fuel, keyed by station id — used to detect
    // real price changes so price_history only grows on an actual movement,
    // matching the old historyStore's "skip if unchanged" behaviour.
    const ids = rows.map((r) => String(r.station_id));
    const existingByFuelChunks = await Promise.all(
      chunk(ids, 1000).map(async (idChunk) => {
        // One retry: the database very occasionally rejects a call with a
        // brief "JWT issued at future" clock-skew error (seen once on
        // 2026-10-03), which is gone a moment later.
        let lastError = "";
        for (let attempt = 0; attempt < 2; attempt++) {
          const { data, error } = await supabase
            .from("stations")
            .select(`id, ${fuel}`)
            .in("id", idChunk);
          if (!error) return data as { id: string; [key: string]: number | string | null }[];
          lastError = error.message;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error(`Failed to load existing prices: ${lastError}`);
      })
    );
    const existingPrice = new Map<string, number | null>();
    for (const rowSet of existingByFuelChunks) {
      for (const r of rowSet) existingPrice.set(r.id, r[fuel] as number | null);
    }

    const upserts = rows.map((row) => ({
      id: String(row.station_id),
      name: row.name ?? "",
      brand: row.brand ?? "",
      street: row.address ?? "",
      place: row.locality ?? "",
      municipality: row.municipality ?? "",
      district: row.district ?? "",
      post_code: row.postal_code,
      lat: row.location.lat,
      lng: row.location.lng,
      [fuel]: row.price_eur,
      updated_at: row.updated_at,
    }));

    const historyInserts: { station_id: string; fuel_type: FuelType; price: number }[] = [];
    for (const row of rows) {
      const id = String(row.station_id);
      const prev = existingPrice.get(id);
      if (prev === undefined || prev !== row.price_eur) {
        historyInserts.push({ station_id: id, fuel_type: fuel, price: row.price_eur });
      }
    }

    for (const batch of chunk(upserts, UPSERT_CHUNK_SIZE)) {
      // PostgREST's upsert only SETs the columns present in the payload on
      // conflict — the other 6 fuel columns aren't listed here, so they're
      // left exactly as they were (a diesel sync never touches gasoline_95,
      // etc). For a brand-new station they simply default to null, same as
      // the old in-memory catalog's emptyPrices().
      const { error } = await supabase.from("stations").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
    }

    for (const batch of chunk(historyInserts, UPSERT_CHUNK_SIZE)) {
      if (batch.length === 0) continue;
      const { error } = await supabase.from("price_history").insert(batch);
      if (error) throw new Error(`History insert failed: ${error.message}`);
    }

    return jsonResponse({
      ok: true,
      fuel,
      stationsSeen: rows.length,
      historyRowsAdded: historyInserts.length,
    });
  } catch (err) {
    console.error("sync-stations failed:", err);
    return jsonResponse({ error: (err as Error).message }, { status: 500 });
  }
});
