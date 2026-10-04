import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { checkIsPro } from "../_shared/station.ts";
import { inCoverage, isValidCoord } from "../_shared/validate.ts";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
// Driving routes between two fixed points don't change — a day-long cache
// keeps repeat "On My Way" searches off Google's free-tier quota.
const CACHE_TTL_MS = 24 * 60 * 60_000;
// Each uncached lookup costs money, so one account can only trigger so many a
// day (normal use is a handful), and a route can't span more than Portugal.
const DAILY_ROUTE_LIMIT = 80;
const MAX_ROUTE_KM = 700;

interface RoutePoint {
  lat: number;
  lng: number;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function resample(points: RoutePoint[], spacingKm: number): RoutePoint[] {
  if (points.length === 0) return [];
  const out: RoutePoint[] = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length; i++) {
    const segKm = haversineKm(points[i - 1], points[i]);
    carried += segKm;
    if (carried >= spacingKm) {
      out.push(points[i]);
      carried = 0;
    }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

async function fetchDrivingRoute(from: RoutePoint, to: RoutePoint, apiKey: string) {
  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineEncoding: "GEO_JSON_LINESTRING",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Routes API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    routes?: {
      distanceMeters?: number;
      duration?: string;
      polyline?: { geoJsonLinestring?: { coordinates?: [number, number][] } };
    }[];
  };

  const route = data.routes?.[0];
  const coords = route?.polyline?.geoJsonLinestring?.coordinates;
  if (!coords || coords.length < 2) throw new Error("Google Routes API returned no route geometry");

  const durationSeconds = route?.duration ? parseFloat(route.duration.replace("s", "")) : 0;

  return {
    polyline: resample(coords.map(([lng, lat]) => ({ lat, lng })), 0.4),
    distanceKm: (route?.distanceMeters ?? 0) / 1000,
    durationMin: durationSeconds / 60,
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const fromLat = Number(url.searchParams.get("fromLat"));
  const fromLng = Number(url.searchParams.get("fromLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  if (
    !["fromLat", "fromLng", "toLat", "toLng"].every((k) => url.searchParams.has(k)) ||
    !isValidCoord(fromLat, fromLng) ||
    !isValidCoord(toLat, toLng)
  ) {
    return jsonResponse({ error: "fromLat, fromLng, toLat, toLng are required numbers" }, { status: 400 });
  }
  if (!inCoverage(fromLat, fromLng) || !inCoverage(toLat, toLng)) {
    return jsonResponse({ error: "Routes are only available within Portugal" }, { status: 400 });
  }
  if (haversineKm({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }) > MAX_ROUTE_KM) {
    return jsonResponse({ error: "Route is too long" }, { status: 400 });
  }

  const apiKey = Deno.env.get("GOOGLE_ROUTES_API_KEY");
  if (!apiKey) return jsonResponse({ error: "GOOGLE_ROUTES_API_KEY is not configured" }, { status: 500 });

  // "On My Way" is a Pro/trial feature client-side — without this check,
  // anyone holding the public anon key could call this endpoint directly and
  // both skip the paywall and spend the paid/quota'd Google Routes API key.
  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );
  const { data: userRes } = await authed.auth.getUser();
  const userId = userRes.user?.id;
  const isPro = userId ? await checkIsPro(authed) : false;
  if (!userId || !isPro) return jsonResponse({ error: "Tanka Pro required" }, { status: 403 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const r = (n: number) => n.toFixed(3);
  const cacheKey = `${r(fromLat)},${r(fromLng)},${r(toLat)},${r(toLng)}`;

  const { data: cached } = await supabase
    .from("route_cache")
    .select("payload, created_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    return jsonResponse(cached.payload);
  }

  // Only lookups that will really hit Google count against the daily limit.
  // If the counter itself is unavailable we carry on rather than break routes.
  const { data: used, error: usageError } = await supabase.rpc("increment_route_usage", { p_user_id: userId });
  if (usageError) {
    console.error("route usage counter unavailable:", usageError.message);
  } else if (typeof used === "number" && used > DAILY_ROUTE_LIMIT) {
    return jsonResponse({ error: "Daily route limit reached, try again tomorrow" }, { status: 429 });
  }

  try {
    const route = await fetchDrivingRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, apiKey);
    await supabase.from("route_cache").upsert({ cache_key: cacheKey, payload: route, created_at: new Date().toISOString() });
    return jsonResponse(route);
  } catch (err) {
    // Google's own error text stays in the log, not in the response.
    console.error("route lookup failed:", (err as Error).message);
    return jsonResponse({ error: "Could not calculate the route" }, { status: 502 });
  }
});
