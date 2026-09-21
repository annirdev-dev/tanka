import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FuelType } from "../types/station";

// Tankerkoenig's API caps search radius at 25km — always querying at that max
// means the app just shows everything nearby with no user-facing distance
// picker needed.
export const MAX_RADIUS_KM = 25;

const STORAGE_KEY = "tanken:filter-defaults";

interface StationFiltersContextValue {
  fuelType: FuelType;
  setFuelType: (type: FuelType) => void;
  openNowOnly: boolean;
  setOpenNowOnly: (value: boolean) => void;
}

const StationFiltersContext = createContext<StationFiltersContextValue | undefined>(undefined);

export function StationFiltersProvider({ children }: { children: React.ReactNode }) {
  const [fuelType, setFuelType] = useState<FuelType>("all");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.fuelType === "string") setFuelType(saved.fuelType);
        if (typeof saved.openNowOnly === "boolean") setOpenNowOnly(saved.openNowOnly);
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    // These are remembered as the user's defaults for next time the app opens,
    // not synced live elsewhere — a plain fire-and-forget write is enough.
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fuelType, openNowOnly }));
  }, [fuelType, openNowOnly, loaded]);

  const value = useMemo(
    () => ({ fuelType, setFuelType, openNowOnly, setOpenNowOnly }),
    [fuelType, openNowOnly]
  );

  return (
    <StationFiltersContext.Provider value={value}>{children}</StationFiltersContext.Provider>
  );
}

export function useStationFilters(): StationFiltersContextValue {
  const ctx = useContext(StationFiltersContext);
  if (!ctx) throw new Error("useStationFilters must be used within a StationFiltersProvider");
  return ctx;
}
