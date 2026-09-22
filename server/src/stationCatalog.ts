import fs from "fs";
import path from "path";
import { fetchAllStationsForFuel, FUEL_TYPES, FuelType, RawStationRow } from "./apiAberta";

export type PriceFields = Record<FuelType, number | null>;

export interface MergedStation extends PriceFields {
  id: string;
  name: string;
  brand: string;
  street: string;
  place: string;
  municipality: string;
  district: string;
  postCode?: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export type SortBy = "price" | "dist";

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "stations.json");

let catalog = new Map<string, MergedStation>();
let lastSyncedAt: number | null = null;
let syncing: Promise<void> | null = null;

function emptyPrices(): PriceFields {
  return Object.fromEntries(FUEL_TYPES.map((fuel) => [fuel, null])) as PriceFields;
}

function loadFromDisk(): void {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { syncedAt: number; stations: MergedStation[] };
    catalog = new Map(parsed.stations.map((s) => [s.id, s]));
    lastSyncedAt = parsed.syncedAt;
    console.log(`Loaded ${catalog.size} stations from disk cache (synced ${new Date(lastSyncedAt).toISOString()})`);
  } catch {
    // No cache yet — first boot before any sync has completed.
  }
}

function saveToDisk(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ syncedAt: lastSyncedAt, stations: Array.from(catalog.values()) })
  );
}

function mergeRows(rowsByFuel: Record<FuelType, RawStationRow[]>): Map<string, MergedStation> {
  const merged = new Map<string, MergedStation>();

  for (const fuel of FUEL_TYPES) {
    for (const row of rowsByFuel[fuel]) {
      const id = String(row.station_id);
      let station = merged.get(id);
      if (!station) {
        station = {
          id,
          name: row.name,
          brand: row.brand,
          street: row.address,
          place: row.locality,
          municipality: row.municipality,
          district: row.district,
          postCode: row.postal_code,
          lat: row.location.lat,
          lng: row.location.lng,
          updatedAt: row.updated_at,
          ...emptyPrices(),
        };
        merged.set(id, station);
      }
      station[fuel] = row.price_eur;
      if (row.updated_at > station.updatedAt) station.updatedAt = row.updated_at;
    }
  }

  return merged;
}

// Fetches the full national list for every road fuel type (~130 requests
// total, throttled to under 60/min by apiAberta.ts — a few minutes) and
// rebuilds the catalog atomically so readers never see a half-merged state.
export async function syncCatalog(): Promise<void> {
  if (syncing) return syncing;

  syncing = (async () => {
    const rowsByFuel = {} as Record<FuelType, RawStationRow[]>;
    for (const fuel of FUEL_TYPES) {
      rowsByFuel[fuel] = await fetchAllStationsForFuel(fuel);
    }
    catalog = mergeRows(rowsByFuel);
    lastSyncedAt = Date.now();
    saveToDisk();
    console.log(`Synced ${catalog.size} stations from API Aberta`);
  })();

  try {
    await syncing;
  } finally {
    syncing = null;
  }
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

export function getStationById(id: string): MergedStation | undefined {
  return catalog.get(id);
}

export function getStationsByIds(ids: string[]): MergedStation[] {
  return ids.map((id) => catalog.get(id)).filter((s): s is MergedStation => Boolean(s));
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface NearbyStation extends MergedStation {
  dist: number;
}

// No location filter exists upstream (see apiAberta.ts), so "nearby" is
// computed locally against the fully-synced catalog instead of being
// forwarded as a live query — this also means results are served instantly
// with no per-request API Aberta call at all.
export function findNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  fuel: FuelType | "all",
  sort: SortBy
): NearbyStation[] {
  const results: NearbyStation[] = [];
  for (const station of catalog.values()) {
    if (fuel !== "all" && station[fuel] === null) continue;
    const dist = haversineKm(lat, lng, station.lat, station.lng);
    if (dist > radiusKm) continue;
    results.push({ ...station, dist });
  }

  if (sort === "price" && fuel !== "all") {
    results.sort((a, b) => (a[fuel] as number) - (b[fuel] as number));
  } else {
    results.sort((a, b) => a.dist - b.dist);
  }
  return results;
}

loadFromDisk();
