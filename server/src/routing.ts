import fetch from "node-fetch";

const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

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

// ORS returns thousands of vertices — far more detail than the app needs to
// draw the line or run corridor math. Resample to roughly one point every
// `spacingKm` so both the payload and the client-side distance checks stay
// cheap, while the shape still follows the real road.
function resample(coords: [number, number][], spacingKm: number): RoutePoint[] {
  if (coords.length === 0) return [];
  const points = coords.map(([lng, lat]) => ({ lat, lng }));
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
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw new Error("ORS_API_KEY is not configured");

  const res = await fetch(ORS_URL, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouteService ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number][] };
      properties?: { summary?: { distance?: number; duration?: number } };
    }[];
  };

  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    throw new Error("OpenRouteService returned no route geometry");
  }

  return {
    polyline: resample(coords, 1.5),
    distanceKm: (feature?.properties?.summary?.distance ?? 0) / 1000,
    durationMin: (feature?.properties?.summary?.duration ?? 0) / 60,
  };
}
