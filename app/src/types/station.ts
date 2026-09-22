// The fuels sold at the pump for road vehicles in Portugal (source: API
// Aberta / DGEG). "all" is a client-side pseudo-type meaning "cheapest
// available fuel at this station" — it's never a key on Station's price
// fields themselves.
export const FUEL_TYPES = [
  "gasoline_95",
  "gasoline_95_plus",
  "gasoline_98",
  "gasoline_98_plus",
  "diesel",
  "diesel_plus",
  "gpl_auto",
] as const;

export type ConcreteFuelType = (typeof FUEL_TYPES)[number];
export type FuelType = ConcreteFuelType | "all";

// Short labels for compact UI (filter chips, alarm picker).
export const FUEL_LABELS: Record<ConcreteFuelType, string> = {
  gasoline_95: "95",
  gasoline_95_plus: "95+",
  gasoline_98: "98",
  gasoline_98_plus: "98+",
  diesel: "Gasóleo",
  diesel_plus: "Gasóleo+",
  gpl_auto: "GPL",
};

// Full official names for the station-detail price list.
export const FUEL_NAMES: Record<ConcreteFuelType, string> = {
  gasoline_95: "Gasolina simples 95",
  gasoline_95_plus: "Gasolina especial 95",
  gasoline_98: "Gasolina 98",
  gasoline_98_plus: "Gasolina especial 98",
  diesel: "Gasóleo simples",
  diesel_plus: "Gasóleo especial",
  gpl_auto: "GPL Auto",
};

export type SortBy = "price" | "dist";
export type HistoryRange = "12h" | "24h" | "3d" | "1w";

export interface TrendInfo {
  delta: number;
  direction: "up" | "down" | "flat";
}

export type Trend = Partial<Record<ConcreteFuelType, TrendInfo>>;

export interface Station extends Record<ConcreteFuelType, number | null> {
  id: string;
  name: string;
  brand: string;
  street: string;
  place: string;
  municipality: string;
  district: string;
  lat: number;
  lng: number;
  // Only present on results from the nearby-search endpoint — a
  // favorited/detail-viewed station looked up directly omits it.
  dist?: number;
  postCode?: string;
  updatedAt: string;
  trend?: Trend;
}

// API Aberta / DGEG carry no opening-hours data, unlike Tankerkoenig — there's
// no "open now" concept for Portuguese stations, so StationDetail adds
// nothing beyond Station.
export type StationDetail = Station;

export interface HistoryPoint {
  fuelType: ConcreteFuelType;
  price: number;
  recordedAt: number;
}
