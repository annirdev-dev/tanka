import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { TtlCache } from "./cache";
import { dedupe } from "./pending";
import * as historyStore from "./historyStore";
import { FuelType, FUEL_TYPES } from "./apiAberta";
import { syncCatalog, getLastSyncedAt, findNearby, getStationById, getStationsByIds, SortBy } from "./stationCatalog";
import { checkPriceAlertsAndNotify } from "./pushAlerts";
import { fetchDrivingRoute } from "./routing";

const app = express();
app.use(cors());

// Driving routes between two fixed points don't change — a long TTL keeps the
// "On My Way" feature off OpenRouteService's 2000/day quota for repeat searches.
const ROUTE_TTL_MS = 24 * 60 * 60_000;
const routeCache = new TtlCache<unknown>(ROUTE_TTL_MS);

function withTrend<T extends { id: string }>(station: T) {
  return { ...station, trend: historyStore.getTrend(station.id) };
}

function recordPrices(station: Record<FuelType, number | null> & { id: string }) {
  const prices: Partial<Record<FuelType, number | null>> = {};
  for (const fuel of FUEL_TYPES) prices[fuel] = station[fuel];
  historyStore.record(station.id, prices);
}

const RANGE_MS: Record<string, number> = {
  "12h": 12 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

function isFuelType(value: unknown): value is FuelType {
  return typeof value === "string" && (FUEL_TYPES as readonly string[]).includes(value);
}

app.get("/health", (_req: Request, res: Response) => {
  // epochMs lets the app anchor time-based logic (e.g. the Pro trial window)
  // to a trusted clock instead of the device's, which can be rolled back.
  res.json({ ok: true, epochMs: Date.now(), catalogSyncedAt: getLastSyncedAt() });
});

app.get("/api/stations/nearby", (req: Request, res: Response) => {
  const rawLat = Number(req.query.lat);
  const rawLng = Number(req.query.lng);
  const rad = req.query.rad ? Number(req.query.rad) : 25;
  const typeParam = req.query.type as string | undefined;
  const type: FuelType | "all" = typeParam && isFuelType(typeParam) ? typeParam : "all";
  // There's no single price field to sort by when comparing every fuel type
  // at once — silently fall back to dist rather than erroring.
  const requestedSort = (req.query.sort as SortBy) ?? "dist";
  const sort: SortBy = type === "all" && requestedSort === "price" ? "dist" : requestedSort;

  if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) {
    return res.status(400).json({ error: "lat and lng are required numbers" });
  }

  const stations = findNearby(rawLat, rawLng, rad, type, sort);
  for (const station of stations) recordPrices(station);
  res.json({ stations: stations.map(withTrend) });
});

app.get("/api/stations/prices", (req: Request, res: Response) => {
  const idsParam = req.query.ids as string | undefined;
  if (!idsParam) return res.status(400).json({ error: "ids query param is required" });
  const ids = idsParam.split(",").filter(Boolean);

  const stations = getStationsByIds(ids);
  for (const station of stations) recordPrices(station);

  const prices = Object.fromEntries(stations.map((s) => [s.id, s]));
  const trends = Object.fromEntries(stations.map((s) => [s.id, historyStore.getTrend(s.id)]));
  res.json({ prices, trends });
});

app.get("/api/stations/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const station = getStationById(id);
  if (!station) return res.status(404).json({ error: "Station not found" });
  recordPrices(station);
  res.json({ station: withTrend(station) });
});

app.get("/api/stations/:id/history", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const range = typeof req.query.range === "string" ? req.query.range : "24h";
  const sinceMs = RANGE_MS[range] ?? RANGE_MS["24h"];
  res.json({ history: historyStore.getHistory(id, sinceMs) });
});

app.get("/api/route", async (req: Request, res: Response) => {
  const fromLat = Number(req.query.fromLat);
  const fromLng = Number(req.query.fromLng);
  const toLat = Number(req.query.toLat);
  const toLng = Number(req.query.toLng);
  if ([fromLat, fromLng, toLat, toLng].some((n) => Number.isNaN(n))) {
    return res.status(400).json({ error: "fromLat, fromLng, toLat, toLng are required numbers" });
  }

  // ~110m precision — a slightly different start/end fix still hits the cache.
  const r = (n: number) => Number(n.toFixed(3));
  const cacheKey = `${r(fromLat)},${r(fromLng)},${r(toLat)},${r(toLng)}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const route = await dedupe(`route:${cacheKey}`, () =>
      fetchDrivingRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng })
    );
    routeCache.set(cacheKey, route);
    res.json(route);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Manual triggers for the background jobs — so testing doesn't mean waiting
// out the sync/alert interval. Unauthenticated, so only mounted outside
// production (most hosts set NODE_ENV=production automatically).
if (process.env.NODE_ENV !== "production") {
  app.post("/api/debug/sync-catalog", async (_req: Request, res: Response) => {
    try {
      await syncCatalog();
      res.json({ ok: true, syncedAt: getLastSyncedAt() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/debug/price-alerts", async (_req: Request, res: Response) => {
    try {
      const summary = await checkPriceAlertsAndNotify();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Tanka API listening on http://localhost:${port}`);
});

// API Aberta / DGEG only refresh fuel prices once a day, so there's no value
// in syncing more often — this just keeps the local catalog from drifting
// more than a few hours stale while staying well clear of the free tier's
// 1000 requests/day cap (~130 requests per full sync).
const CATALOG_SYNC_INTERVAL_MS = 6 * 60 * 60_000;
syncCatalog().catch((err) => console.error("Initial catalog sync failed:", err));
setInterval(() => {
  syncCatalog().catch((err) => console.error("Catalog sync failed:", err));
}, CATALOG_SYNC_INTERVAL_MS);

// Lets price alerts fire even while the app is closed. Checking every 15
// minutes is essentially free since it reads the already-synced in-memory
// catalog rather than calling API Aberta again — it just means an alarm
// fires within 15 minutes of the next catalog sync landing, not that prices
// themselves change that often. No-ops silently until SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are set.
const PRICE_ALERT_INTERVAL_MS = 15 * 60_000;
setInterval(() => {
  checkPriceAlertsAndNotify()
    .then((summary) => {
      if (summary.pushSent > 0 || summary.pushErrors.length > 0) {
        console.log("Price-alert job:", JSON.stringify(summary));
      }
    })
    .catch((err) => console.error("Price-alert job crashed:", err));
}, PRICE_ALERT_INTERVAL_MS);
