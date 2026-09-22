import fs from "fs";
import path from "path";
import { FuelType, FUEL_TYPES } from "./apiAberta";

interface Snapshot {
  fuelType: FuelType;
  price: number;
  recordedAt: number;
}

export interface TrendInfo {
  delta: number;
  direction: "up" | "down" | "flat";
}

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "history.json");
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 5_000;

const store = new Map<string, Snapshot[]>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): void {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, Snapshot[]>;
    for (const [stationId, snapshots] of Object.entries(parsed)) {
      store.set(stationId, snapshots);
    }
  } catch {
    // No history file yet — starting fresh is expected on first run.
  }
}

function saveNow(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const plain: Record<string, Snapshot[]> = {};
  for (const [stationId, snapshots] of store) plain[stationId] = snapshots;
  fs.writeFileSync(DATA_FILE, JSON.stringify(plain));
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, SAVE_DEBOUNCE_MS);
}

load();

export function record(stationId: string, prices: Partial<Record<FuelType, number | null>>): void {
  const now = Date.now();
  const existing = store.get(stationId) ?? [];

  for (const key of FUEL_TYPES) {
    const price = prices[key];
    if (typeof price !== "number") continue;
    const last = [...existing].reverse().find((s) => s.fuelType === key);
    // Skip if unchanged from the last recorded value — keeps the log to real price movements.
    if (last && last.price === price) continue;
    existing.push({ fuelType: key, price, recordedAt: now });
  }

  const trimmed = existing.filter((s) => now - s.recordedAt < MAX_AGE_MS);
  store.set(stationId, trimmed);
  scheduleSave();
}

export function getHistory(stationId: string, sinceMs: number): Snapshot[] {
  const cutoff = Date.now() - sinceMs;
  return (store.get(stationId) ?? []).filter((s) => s.recordedAt >= cutoff);
}

export function getTrend(stationId: string): Partial<Record<FuelType, TrendInfo>> {
  const snapshots = store.get(stationId) ?? [];
  const result: Partial<Record<FuelType, TrendInfo>> = {};

  for (const key of FUEL_TYPES) {
    const forFuel = snapshots.filter((s) => s.fuelType === key);
    if (forFuel.length < 2) continue;
    const latest = forFuel[forFuel.length - 1];
    const previous = forFuel[forFuel.length - 2];
    const delta = Math.round((latest.price - previous.price) * 1000) / 1000;
    result[key] = {
      delta,
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    };
  }

  return result;
}
