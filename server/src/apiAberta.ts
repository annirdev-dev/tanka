import fetch from "node-fetch";

const BASE_URL = "https://api.apiaberta.pt/v1/fuel/stations";
// Server-enforced ceiling — requesting more than this returns a 400.
const PAGE_LIMIT = 100;

function apiKey(): string {
  const key = process.env.API_ABERTA_KEY;
  if (!key) throw new Error("API_ABERTA_KEY is not set");
  return key;
}

// Free tier allows 60 requests/minute — a full catalog sync makes well over
// one request, so this keeps us comfortably under that even accounting for
// network jitter, rather than bursting and risking a 429 mid-sync.
const MIN_REQUEST_INTERVAL_MS = 1_100;
let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function throttledFetch(url: string): Promise<import("node-fetch").Response> {
  const result = requestQueue.then(async () => {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fetch(url, { headers: { "X-API-Key": apiKey() } });
  });
  requestQueue = result.catch(() => undefined);
  return result;
}

// The only fuels sold at the pump for road vehicles — excludes heating
// gasoil, marine/agricultural diesel, 2-stroke mix, and the natural-gas
// fuels (GNC/GNL), which API Aberta also tracks but are irrelevant to an
// app about comparing prices to fill up a car.
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

export const FUEL_NAMES: Record<FuelType, string> = {
  gasoline_95: "Gasolina simples 95",
  gasoline_95_plus: "Gasolina especial 95",
  gasoline_98: "Gasolina 98",
  gasoline_98_plus: "Gasolina especial 98",
  diesel: "Gasóleo simples",
  diesel_plus: "Gasóleo especial",
  gpl_auto: "GPL Auto",
};

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

async function fetchPage(fuel: FuelType, page: number): Promise<RawStationsResponse> {
  const url = new URL(BASE_URL);
  url.searchParams.set("fuel", fuel);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_LIMIT));

  const res = await throttledFetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API Aberta ${res.status} on fuel=${fuel} page=${page}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as RawStationsResponse;
}

// Loops every page for one fuel type until the reported page count is
// exhausted. There's no radius/location filter on this endpoint — API Aberta
// only paginates a flat national list, so "nearby" search has to be done
// locally against a full downloaded copy (see stationCatalog.ts).
export async function fetchAllStationsForFuel(fuel: FuelType): Promise<RawStationRow[]> {
  const first = await fetchPage(fuel, 1);
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.pages; page++) {
    const next = await fetchPage(fuel, page);
    rows.push(...next.data);
  }
  return rows;
}

export type { RawStationRow };
