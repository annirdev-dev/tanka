// Input checks shared by the public functions. The app only covers Portugal
// (mainland, Madeira, the Azores), so anything else is either a mistake or an
// attempt to use the backend for something it isn't for.

interface Box {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const COVERAGE: Box[] = [
  { minLat: 36.8, maxLat: 42.3, minLng: -9.7, maxLng: -6.0 }, // mainland
  { minLat: 32.2, maxLat: 33.3, minLng: -17.4, maxLng: -16.1 }, // Madeira
  { minLat: 36.8, maxLat: 39.9, minLng: -31.5, maxLng: -24.8 }, // Azores
];

export function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function inCoverage(lat: number, lng: number): boolean {
  return COVERAGE.some((b) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Station ids from the fuel-price source are short alphanumeric strings.
export function isStationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(value);
}

// Splits `n` items into groups of at most `size` (used to respect the push
// service's 100-messages-per-request limit).
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Same rule as the SQL function is_user_pro(): Pro, or still inside the trial.
// If the 5 here ever changes, change it in the migration and the app too.
export const TRIAL_DAYS = 5;
export function isProRow(
  row: { has_pro?: boolean | null; trial_started_at?: number | string | null },
  now: number = Date.now()
): boolean {
  if (row.has_pro) return true;
  if (row.trial_started_at == null) return false;
  const start = Number(row.trial_started_at);
  return Number.isFinite(start) && now < start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
}
