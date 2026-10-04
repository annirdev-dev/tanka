import { createClient } from "npm:@supabase/supabase-js@2";

// Loosely typed on purpose: the callers build clients with different generics,
// and there is no generated database type in this project.
// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

// The fuels sold at the pump for road vehicles in Portugal (source: API
// Aberta / DGEG) — mirrors app/src/types/station.ts exactly, since the JSON
// shape returned here must match what the app expects with zero changes.
export const FUEL_TYPES = [
  "gasoline_95",
  "gasoline_95_plus",
  "gasoline_98",
  "gasoline_98_plus",
  "diesel",
  "diesel_plus",
  "gpl_auto",
] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export interface StationRow {
  id: string;
  name: string;
  brand: string;
  street: string;
  place: string;
  municipality: string;
  district: string;
  post_code: string | null;
  lat: number;
  lng: number;
  gasoline_95: number | null;
  gasoline_95_plus: number | null;
  gasoline_98: number | null;
  gasoline_98_plus: number | null;
  diesel: number | null;
  diesel_plus: number | null;
  gpl_auto: number | null;
  updated_at: string;
  dist_km?: number;
}

export interface TrendRow {
  station_id: string;
  fuel_type: FuelType;
  delta: number;
  direction: "up" | "down" | "flat";
}

// Converts a DB row (snake_case) into the exact camelCase shape the app's
// Station type expects, attaching this station's slice of a batch trends
// lookup (see stations_trends() in the DB).
export function toStation(row: StationRow, trends?: TrendRow[]) {
  const trend: Record<string, { delta: number; direction: string }> = {};
  for (const t of trends ?? []) {
    if (t.station_id === row.id) trend[t.fuel_type] = { delta: t.delta, direction: t.direction };
  }
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    street: row.street,
    place: row.place,
    municipality: row.municipality,
    district: row.district,
    postCode: row.post_code ?? undefined,
    lat: row.lat,
    lng: row.lng,
    updatedAt: row.updated_at,
    ...(row.dist_km != null ? { dist: row.dist_km } : {}),
    gasoline_95: row.gasoline_95,
    gasoline_95_plus: row.gasoline_95_plus,
    gasoline_98: row.gasoline_98,
    gasoline_98_plus: row.gasoline_98_plus,
    diesel: row.diesel,
    diesel_plus: row.diesel_plus,
    gpl_auto: row.gpl_auto,
    trend,
  };
}

// Free/expired-trial callers see prices as of this many hours ago instead of
// live ones — real information gap, not just a UI restriction, so there's a
// genuine reason to upgrade rather than just an inconvenience to work around.
export const PRICE_DELAY_HOURS = 24;

// A signed-out caller (using only the anon key, no user JWT) has no trial or
// purchase to check — correctly treated as not Pro.
export async function checkIsPro(supabase: SupabaseClient): Promise<boolean> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase.rpc("is_user_pro", { p_user_id: userId });
  if (error) return false;
  return Boolean(data);
}

const FUEL_KEYS = [
  "gasoline_95",
  "gasoline_95_plus",
  "gasoline_98",
  "gasoline_98_plus",
  "diesel",
  "diesel_plus",
  "gpl_auto",
] as const;

// Overwrites each row's live price fields with whatever was actually
// recorded at/before `asOf` — returns the same rows unchanged for any
// station with no reading that old yet (early in this table's lifetime).
export async function applyDelayedPrices(
  supabase: SupabaseClient,
  rows: StationRow[],
  asOf: Date
): Promise<StationRow[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows;
  const { data, error } = await supabase.rpc("stations_delayed_prices", {
    p_station_ids: ids,
    p_as_of: asOf.toISOString(),
  });
  if (error) return rows;

  const byStation = new Map<string, Partial<Record<FuelType, number>>>();
  for (const d of data as { station_id: string; fuel_type: FuelType; price: number }[]) {
    if (!byStation.has(d.station_id)) byStation.set(d.station_id, {});
    byStation.get(d.station_id)![d.fuel_type] = d.price;
  }

  return rows.map((row) => {
    const delayed = byStation.get(row.id);
    if (!delayed) return row;
    const patched = { ...row };
    for (const fuel of FUEL_KEYS) {
      patched[fuel] = fuel in delayed ? (delayed[fuel] as number) : null;
    }
    return patched;
  });
}
