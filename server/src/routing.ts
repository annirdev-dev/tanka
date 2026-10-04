import fetch from "node-fetch";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  polyline: RoutePoint[];
  distanceKm: number;
  durationMin: number;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Google returns a vertex roughly every few metres — far more detail than the
// app needs to draw the line or run corridor math. Resample to roughly one
// point every `spacingKm` so both the payload and the client-side distance
// checks stay cheap, while the shape still hugs the real road closely enough
// that a station near a bend isn't misjudged as off-route.
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

export async function fetchDrivingRoute(
  from: RoutePoint,
  to: RoutePoint
): Promise<RouteResult> {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_ROUTES_API_KEY is not configured");

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Only ask for what we use — Google bills/rate-limits based in part on
      // response size, and a narrow field mask is required by the API anyway.
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: "DRIVE",
      // Keeps this on the free "Essentials" SKU (10k free requests/month).
      // TRAFFIC_AWARE / TRAFFIC_AWARE_OPTIMAL bill as "Pro" instead.
      routingPreference: "TRAFFIC_UNAWARE",
      // GeoJSON coordinates avoid having to decode Google's polyline5 format.
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
  if (!coords || coords.length < 2) {
    throw new Error("Google Routes API returned no route geometry");
  }

  // duration comes back as a protobuf Duration string, e.g. "5423s".
  const durationSeconds = route?.duration ? parseFloat(route.duration.replace("s", "")) : 0;

  return {
    polyline: resample(
      coords.map(([lng, lat]) => ({ lat, lng })),
      0.4
    ),
    distanceKm: (route?.distanceMeters ?? 0) / 1000,
    durationMin: durationSeconds / 60,
  };
}
