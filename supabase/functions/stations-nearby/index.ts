import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import {
  FUEL_TYPES,
  FuelType,
  PRICE_DELAY_HOURS,
  StationRow,
  TrendRow,
  applyDelayedPrices,
  checkIsPro,
  toStation,
} from "../_shared/station.ts";
import { clamp, isValidCoord } from "../_shared/validate.ts";

function isFuelType(value: string | null): value is FuelType {
  return !!value && (FUEL_TYPES as readonly string[]).includes(value);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  // Radius is bounded: Portugal is small, and an unbounded value would let
  // one request pull the whole table.
  const radRaw = url.searchParams.get("rad") ? Number(url.searchParams.get("rad")) : 25;
  const rad = Number.isFinite(radRaw) ? clamp(radRaw, 0.1, 100) : 25;
  const typeParam = url.searchParams.get("type");
  const type: FuelType | "all" = isFuelType(typeParam) ? typeParam : "all";
  const requestedSort = url.searchParams.get("sort") ?? "dist";
  // No single price field to sort by across every fuel at once — fall back
  // to dist rather than erroring, matching the old server's behaviour.
  const sort = type === "all" && requestedSort === "price" ? "dist" : requestedSort;

  if (!url.searchParams.has("lat") || !url.searchParams.has("lng") || !isValidCoord(lat, lng)) {
    return jsonResponse({ error: "lat and lng are required numbers" }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data, error } = await supabase.rpc("nearby_stations", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: rad,
    p_fuel: type,
  });
  if (error) {
    // Details stay in the function log; callers get a generic message.
    console.error("nearby_stations failed:", error.message);
    return jsonResponse({ error: "Could not load stations" }, { status: 500 });
  }

  const isPro = await checkIsPro(supabase);
  const pricesAsOf = isPro ? null : new Date(Date.now() - PRICE_DELAY_HOURS * 60 * 60 * 1000);
  let rows = data as StationRow[];
  if (pricesAsOf) rows = await applyDelayedPrices(supabase, rows, pricesAsOf);

  if (sort === "price" && type !== "all") {
    rows.sort((a, b) => (a[type] as number) - (b[type] as number));
  } else {
    rows.sort((a, b) => (a.dist_km ?? 0) - (b.dist_km ?? 0));
  }

  const ids = rows.map((r) => r.id);
  const { data: trends } = ids.length
    ? await supabase.rpc("stations_trends", { p_station_ids: ids })
    : { data: [] as TrendRow[] };

  return jsonResponse({
    stations: rows.map((r) => toStation(r, trends as TrendRow[])),
    pricesAsOf: pricesAsOf?.toISOString() ?? null,
  });
});
