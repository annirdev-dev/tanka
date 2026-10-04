import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { PRICE_DELAY_HOURS, checkIsPro } from "../_shared/station.ts";
import { isStationId } from "../_shared/validate.ts";

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!isStationId(id)) return jsonResponse({ error: "id query param is required" }, { status: 400 });
  const range = url.searchParams.get("range") ?? "24h";
  const sinceMs = RANGE_MS[range] ?? RANGE_MS["24h"];
  const cutoff = new Date(Date.now() - sinceMs).toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  // Without this, a free user could read today's real price off the chart's
  // most recent point even with the live price fields elsewhere delayed.
  const isPro = await checkIsPro(supabase);
  const pricesAsOf = isPro ? null : new Date(Date.now() - PRICE_DELAY_HOURS * 60 * 60 * 1000);

  let query = supabase
    .from("price_history")
    .select("fuel_type, price, recorded_at")
    .eq("station_id", id)
    .gte("recorded_at", cutoff)
    .order("recorded_at", { ascending: true });
  if (pricesAsOf) query = query.lte("recorded_at", pricesAsOf.toISOString());

  const { data, error } = await query;
  if (error) {
    console.error("price_history select failed:", error.message);
    return jsonResponse({ error: "Could not load price history" }, { status: 500 });
  }

  const history = (data as { fuel_type: string; price: number; recorded_at: string }[]).map((row) => ({
    fuelType: row.fuel_type,
    price: row.price,
    recordedAt: new Date(row.recorded_at).getTime(),
  }));

  return jsonResponse({ history, pricesAsOf: pricesAsOf?.toISOString() ?? null });
});
