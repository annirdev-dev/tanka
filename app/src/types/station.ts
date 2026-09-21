export type FuelType = "e5" | "e10" | "diesel" | "all";
export type SortBy = "price" | "dist";
export type HistoryRange = "12h" | "24h" | "3d" | "1w";

export interface TrendInfo {
  delta: number;
  direction: "up" | "down" | "flat";
}

export interface Trend {
  e5?: TrendInfo;
  e10?: TrendInfo;
  diesel?: TrendInfo;
}

export interface Station {
  id: string;
  name: string;
  brand: string;
  street: string;
  place: string;
  lat: number;
  lng: number;
  // Only present on results from the nearby-search endpoint — Tankerkoenig's
  // detail lookup (used to enrich a favorited/detail-viewed station) omits it.
  dist?: number;
  diesel: number | null;
  e5: number | null;
  e10: number | null;
  isOpen: boolean;
  houseNumber?: string;
  postCode?: number;
  trend?: Trend;
}

export interface StationDetail extends Station {
  wholeDay: boolean;
  state: string;
  openingTimes?: OpeningTime[];
}

export interface OpeningTime {
  text: string;
  start: string;
  end: string;
}

export interface HistoryPoint {
  fuelType: "e5" | "e10" | "diesel";
  price: number;
  recordedAt: number;
}
