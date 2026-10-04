import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import {
  PRICE_DELAY_HOURS,
  StationRow,
  TrendRow,
  applyDelayedPrices,
  checkIsPro,
  toStation,
} from "../_shared/station.ts";
import { isStationId } from "../_shared/validate.ts";

// Per request; the app sends longer favorite lists in groups of this size.
const MAX_IDS = 100;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) return jsonResponse({ error: "ids query param is required" }, { status: 400 });
  const ids = idsParam.split(",").filter(isStationId).slice(0, MAX_IDS);
  if (ids.length === 0) return jsonResponse({ error: "ids must be station ids" }, { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data, error } = await supabase.from("stations").select("*").in("id", ids);
  if (error) {
    console.error("stations select failed:", error.message);
    return jsonResponse({ error: "Could not load prices" }, { status: 500 });
  }

  const isPro = await checkIsPro(supabase);
  const pricesAsOf = isPro ? null : new Date(Date.now() - PRICE_DELAY_HOURS * 60 * 60 * 1000);
  let rows = data as StationRow[];
  if (pricesAsOf) rows = await applyDelayedPrices(supabase, rows, pricesAsOf);

  const { data: trendRows } = ids.length
    ? await supabase.rpc("stations_trends", { p_station_ids: ids })
    : { data: [] as TrendRow[] };
  const trends = trendRows as TrendRow[];

  const prices: Record<string, unknown> = {};
  const trendsByStation: Record<string, Record<string, { delta: number; direction: string }>> = {};
  for (const row of rows) {
    prices[row.id] = toStation(row, trends);
    const trend: Record<string, { delta: number; direction: string }> = {};
    for (const t of trends.filter((t) => t.station_id === row.id)) {
      trend[t.fuel_type] = { delta: t.delta, direction: t.direction };
    }
    trendsByStation[row.id] = trend;
  }

  return jsonResponse({ prices, trends: trendsByStation, pricesAsOf: pricesAsOf?.toISOString() ?? null });
});
