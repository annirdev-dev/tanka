import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNearbyStations } from "../api/client";
import { usePurchase } from "../context/PurchaseContext";
import { FuelType, SortBy, Station } from "../types/station";

interface Options {
  rad?: number;
  type?: FuelType;
  sort?: SortBy;
}

export function useNearbyStations(
  coords: { lat: number; lng: number } | null,
  options: Options = {}
) {
  const [stations, setStations] = useState<Station[]>([]);
  const [pricesAsOf, setPricesAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rad, type, sort } = options;
  // Live vs delayed prices is decided by the server per account, so when the
  // account's entitlement changes (Pro purchase recorded, trial ended) the
  // prices already on screen are the wrong kind and must be fetched again.
  const { entitlementVersion } = usePurchase();
  // The API only includes price fields for the requested fuel type, so stale
  // stations from a previous type would render mismatched/missing prices if
  // left on screen while the new type's request is still in flight.
  const lastFetchedType = useRef<FuelType | undefined>(undefined);
  // Tankerkoenig's global 1-request/minute throttle means an older request
  // (e.g. for a fuel type the user already switched away from) can resolve
  // after a newer one. Track which call is the latest so a slow, stale
  // response can never overwrite what the user is currently looking at.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!coords) return;
    const requestId = ++requestIdRef.current;
    if (lastFetchedType.current !== type) setStations([]);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchNearbyStations(coords.lat, coords.lng, { rad, type, sort });
      if (requestIdRef.current !== requestId) return;
      setStations(result.stations);
      setPricesAsOf(result.pricesAsOf);
      lastFetchedType.current = type;
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError((err as Error).message);
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [coords, rad, type, sort, entitlementVersion]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stations, pricesAsOf, loading, error, refresh };
}
