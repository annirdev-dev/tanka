import { supabase } from "../lib/supabase";
import { ConcreteFuelType, FuelType, HistoryPoint, HistoryRange, SortBy, Station, StationDetail, Trend } from "../types/station";

// The backend is a set of Supabase Edge Functions (see supabase/functions/)
// rather than a standalone server — this needs no separately-hosted URL and
// never goes stale the way a local dev tunnel does.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`;

async function getJson<T>(functionName: string, params?: URLSearchParams): Promise<T> {
  const query = params ? `?${params}` : "";
  // Sending the signed-in user's own session token (not just the shared anon
  // key) lets the backend identify who's asking, so it can tell a Pro/trial
  // account from a free one and decide whether to serve live or delayed
  // prices — a client-side-only check here would be trivial to bypass.
  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  const res = await fetch(`${FUNCTIONS_BASE_URL}/${functionName}${query}`, {
    headers: {
      Authorization: `Bearer ${userToken ?? SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
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
): Promise<{ stations: Station[]; pricesAsOf: string | null }> {
  const { rad = 25, type = "all", sort = "dist" } = options;
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    rad: String(rad),
    type,
    sort,
  });
  const data = await getJson<{ stations: Station[]; pricesAsOf: string | null }>(
    "stations-nearby",
    params
  );
  return { stations: data.stations, pricesAsOf: data.pricesAsOf ?? null };
}

// Server wall-clock (epoch ms), used to detect a rolled-back device clock.
// Returns null if the backend can't be reached.
export async function fetchServerTime(): Promise<number | null> {
  try {
    const data = await getJson<{ epochMs?: number }>("health");
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
  return getJson<DrivingRoute>("route", params);
}

export async function fetchStationDetail(
  id: string
): Promise<{ station: StationDetail; pricesAsOf: string | null }> {
  const data = await getJson<{ station: StationDetail; pricesAsOf: string | null }>(
    "stations-detail",
    new URLSearchParams({ id })
  );
  return { station: data.station, pricesAsOf: data.pricesAsOf ?? null };
}

export async function fetchStationHistory(
  id: string,
  range: HistoryRange
): Promise<{ history: HistoryPoint[]; pricesAsOf: string | null }> {
  const data = await getJson<{ history: HistoryPoint[]; pricesAsOf: string | null }>(
    "stations-history",
    new URLSearchParams({ id, range })
  );
  return { history: data.history, pricesAsOf: data.pricesAsOf ?? null };
}

export type BatchPriceEntry = Record<ConcreteFuelType, number | null>;

export async function fetchStationPrices(
  ids: string[]
): Promise<{ prices: Record<string, BatchPriceEntry>; trends: Record<string, Trend> }> {
  // The backend answers for at most 100 stations per request, so a long list
  // of favorites goes out in groups and the answers are merged.
  const prices: Record<string, BatchPriceEntry> = {};
  const trends: Record<string, Trend> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const params = new URLSearchParams({ ids: ids.slice(i, i + 100).join(",") });
    const part = await getJson<{ prices: Record<string, BatchPriceEntry>; trends: Record<string, Trend> }>(
      "stations-prices",
      params
    );
    Object.assign(prices, part.prices);
    Object.assign(trends, part.trends);
  }
  return { prices, trends };
}

// Asks the backend to mark the signed-in account as Pro. The backend does not
// take our word for it: it looks the purchase up at the store (Apple's App
// Store Server API, or Google's Play Developer API for Android) and only
// records Pro if the store confirms a real, unrevoked purchase of this product
// for this app. It must go through this authenticated endpoint rather than
// writing user_data.has_pro directly, which the database rejects from
// anything but the service role (see
// supabase/migrations/20260926120000_security_hardening.sql).
// `receipt` is StoreKit's signed record on iOS (optional backup proof) and
// the Google Play purchase token on Android (required).
export async function confirmPurchase(
  productId: string,
  transactionId: string,
  platform: string,
  receipt?: string
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  if (!userToken) return;
  const isAndroid = platform === "android";
  const res = await fetch(
    `${FUNCTIONS_BASE_URL}/${isAndroid ? "confirm-purchase-google" : "confirm-purchase"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        isAndroid
          ? { productId, purchaseToken: receipt }
          : { productId, transactionId, platform, signedTransaction: receipt }
      ),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // `code` tells the app why the backend refused: "revoked" = the store
    // refunded this purchase, so the app must lock Pro again.
    const err = new Error(body.error ?? `Request failed with status ${res.status}`) as Error & {
      code?: string;
    };
    err.code = body.code;
    throw err;
  }
}

// Deletes the signed-in account on the backend. For accounts that use Sign in
// with Apple, the backend also revokes Apple's link, which needs the
// authorization code from a fresh Apple sign-in.
export async function deleteAccountOnServer(appleAuthorizationCode?: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  if (!userToken) throw new Error("Not signed in");
  const res = await fetch(`${FUNCTIONS_BASE_URL}/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ appleAuthorizationCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
}
