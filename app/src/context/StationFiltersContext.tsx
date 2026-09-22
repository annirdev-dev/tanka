import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FuelType } from "../types/station";

// A default "nearby" radius — unlike Tankerkoenig, API Aberta has no hard
// server-side cap, this is purely a UX choice for how far out to search.
export const MAX_RADIUS_KM = 25;

const STORAGE_KEY = "tanka:filter-defaults";

interface StationFiltersContextValue {
  fuelType: FuelType;
  setFuelType: (type: FuelType) => void;
}

const StationFiltersContext = createContext<StationFiltersContextValue | undefined>(undefined);

export function StationFiltersProvider({ children }: { children: React.ReactNode }) {
  const [fuelType, setFuelType] = useState<FuelType>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.fuelType === "string") setFuelType(saved.fuelType);
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    // Remembered as the user's default for next time the app opens, not
    // synced live elsewhere — a plain fire-and-forget write is enough.
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fuelType }));
  }, [fuelType, loaded]);

  const value = useMemo(() => ({ fuelType, setFuelType }), [fuelType]);

  return (
    <StationFiltersContext.Provider value={value}>{children}</StationFiltersContext.Provider>
  );
}

export function useStationFilters(): StationFiltersContextValue {
  const ctx = useContext(StationFiltersContext);
  if (!ctx) throw new Error("useStationFilters must be used within a StationFiltersProvider");
  return ctx;
}
