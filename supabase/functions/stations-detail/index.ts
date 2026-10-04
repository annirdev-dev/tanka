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

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!isStationId(id)) return jsonResponse({ error: "id query param is required" }, { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data, error } = await supabase.from("stations").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("station select failed:", error.message);
    return jsonResponse({ error: "Could not load station" }, { status: 500 });
  }
  if (!data) return jsonResponse({ error: "Station not found" }, { status: 404 });

  const isPro = await checkIsPro(supabase);
  const pricesAsOf = isPro ? null : new Date(Date.now() - PRICE_DELAY_HOURS * 60 * 60 * 1000);
  let row = data as StationRow;
  if (pricesAsOf) [row] = await applyDelayedPrices(supabase, [row], pricesAsOf);

  const { data: trends } = await supabase.rpc("stations_trends", { p_station_ids: [id] });

  return jsonResponse({
    station: toStation(row, trends as TrendRow[]),
    pricesAsOf: pricesAsOf?.toISOString() ?? null,
  });
});
