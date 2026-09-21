import { FuelType, Station } from "../types/station";

export function displayPrice(station: Station, fuelType: FuelType): number | null {
  if (fuelType === "e5") return station.e5 ?? null;
  if (fuelType === "e10") return station.e10 ?? null;
  if (fuelType === "diesel") return station.diesel ?? null;
  const prices = [station.e5, station.e10, station.diesel].filter(
    (p): p is number => p != null
  );
  return prices.length ? Math.min(...prices) : null;
}

export function formatPrice(price: number | null | undefined): string {
  return price == null ? "—" : `${price.toFixed(3)} €`;
}
