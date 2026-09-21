import { FuelType, HistoryPoint, HistoryRange, SortBy, Station, StationDetail, Trend } from "../types/station";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// The backend is now a Supabase Edge Function, which requires a valid
// Supabase API key on every request (anon key is fine — these are public,
// unauthenticated endpoints, this just satisfies Supabase's own gateway).
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const AUTH_HEADERS = { Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: AUTH_HEADERS });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchNearbyStations(
  lat: number,
  lng: number,
  options: { rad?: number; type?: FuelType; sort?: SortBy } = {}
): Promise<Station[]> {
  const { rad = 25, type = "all", sort = "dist" } = options;
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    rad: String(rad),
    type,
    sort,
  });
  const data = await getJson<{ stations: Station[] }>(`/api/stations/nearby?${params}`);
  return data.stations;
}

// Server wall-clock (epoch ms), used to detect a rolled-back device clock.
// Returns null if the backend can't be reached.
export async function fetchServerTime(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { headers: AUTH_HEADERS });
    if (!res.ok) return null;
    const data = (await res.json()) as { epochMs?: number };
    return typeof data.epochMs === "number" ? data.epochMs : null;
  } catch {
    return null;
  }
}

export interface DrivingRoute {
  polyline: { lat: number; lng: number }[];
  distanceKm: number;
  durationMin: number;
}

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<DrivingRoute> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  return getJson<DrivingRoute>(`/api/route?${params}`);
}

export async function fetchStationDetail(id: string): Promise<StationDetail> {
  const data = await getJson<{ station: StationDetail }>(`/api/stations/${id}`);
  return data.station;
}

export async function fetchStationHistory(
  id: string,
  range: HistoryRange
): Promise<HistoryPoint[]> {
  const data = await getJson<{ history: HistoryPoint[] }>(
    `/api/stations/${id}/history?range=${range}`
  );
  return data.history;
}

export interface BatchPriceEntry {
  status: "open" | "closed" | "no prices";
  e5: number | false;
  e10: number | false;
  diesel: number | false;
}

export async function fetchStationPrices(
  ids: string[]
): Promise<{ prices: Record<string, BatchPriceEntry>; trends: Record<string, Trend> }> {
  const params = new URLSearchParams({ ids: ids.join(",") });
  return getJson(`/api/stations/prices?${params}`);
}

