import { FUEL_TYPES, FuelType, Station } from "../types/station";

export function displayPrice(station: Station, fuelType: FuelType): number | null {
  if (fuelType !== "all") return station[fuelType] ?? null;
  const prices = FUEL_TYPES.map((f) => station[f]).filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}

export function formatPrice(price: number | null | undefined): string {
  return price == null ? "—" : `${price.toFixed(3)} €`;
}
