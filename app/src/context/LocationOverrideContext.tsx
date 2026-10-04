import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TEST_TOOLS } from "../lib/testTools";

const STORAGE_KEY = "tanka:location-override";

export interface Coords {
  lat: number;
  lng: number;
}

interface LocationOverrideContextValue {
  override: Coords | null;
  setOverride: (coords: Coords | null) => void;
}

const LocationOverrideContext = createContext<LocationOverrideContextValue | undefined>(undefined);

// Test builds only (see lib/testTools): in any other build the stored value is
// never read, so a leftover override can't ever move a real user's location.
export function LocationOverrideProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<Coords | null>(null);

  useEffect(() => {
    if (!TEST_TOOLS) return;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          setOverrideState(parsed);
        }
      } catch {
        // ignore malformed stored value
      }
    });
  }, []);

  const setOverride = (coords: Coords | null) => {
    setOverrideState(coords);
    if (coords) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    } else {
      AsyncStorage.removeItem(STORAGE_KEY);
    }
  };

  const value = useMemo(() => ({ override, setOverride }), [override]);

  return <LocationOverrideContext.Provider value={value}>{children}</LocationOverrideContext.Provider>;
}

export function useLocationOverride(): LocationOverrideContextValue {
  const ctx = useContext(LocationOverrideContext);
  if (!ctx) throw new Error("useLocationOverride must be used within a LocationOverrideProvider");
  return ctx;
}
