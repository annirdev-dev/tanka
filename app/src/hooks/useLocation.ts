import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { useLocationOverride } from "../context/LocationOverrideContext";
import { LISBON, isInPortugal } from "../utils/geo";

// getCurrentPositionAsync has no built-in timeout — without one, a stuck GPS/mock
// provider (e.g. right after toggling a mock-location app) leaves the user on an
// infinite spinner with no way to recover short of force-closing the app.
const LOCATION_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Why the app is showing Lisbon instead of the real position:
//  "outside" — the phone is outside Portugal (Tanka only has Portuguese stations)
//  "off"     — location permission is off, or no fix could be obtained
export type LocationFallback = "outside" | "off";

interface LocationState {
  coords: { lat: number; lng: number } | null;
  errorMsg: string | null;
  loading: boolean;
  fallback: LocationFallback | null;
  retry: () => void;
}

// A real fix inside Portugal is used as is; outside it there is nothing to
// show, so the app falls back to Lisbon (and says so).
function resolved(point: { lat: number; lng: number }): Omit<LocationState, "retry"> {
  return isInPortugal(point)
    ? { coords: point, errorMsg: null, loading: false, fallback: null }
    : { coords: LISBON, errorMsg: null, loading: false, fallback: "outside" };
}

export function useLocation(): LocationState {
  const [state, setState] = useState<Omit<LocationState, "retry">>({
    coords: null,
    errorMsg: null,
    loading: true,
    fallback: null,
  });
  const requestIdRef = useRef(0);
  // Only ever non-null in test builds (see lib/testTools) — the provider never
  // reads or sets it anywhere else.
  const { override } = useLocationOverride();

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    if (override) {
      setState({ coords: override, errorMsg: null, loading: false, fallback: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (requestIdRef.current !== requestId) return;
      if (status !== "granted") {
        // Not forced: without permission the app still works, showing Lisbon.
        setState({ coords: LISBON, errorMsg: null, loading: false, fallback: "off" });
        return;
      }

      // A fresh GPS fix can take several seconds, especially on a cold start —
      // show a cached fix immediately (if the OS has one) so the user sees
      // results right away, then quietly refine with the real fix below
      // instead of leaving the whole screen on a spinner in the meantime.
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(
        () => null
      );
      if (requestIdRef.current !== requestId) return;
      if (lastKnown) {
        setState(resolved({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude }));
      }

      try {
        const position = await withTimeout(
          Location.getCurrentPositionAsync({}),
          LOCATION_TIMEOUT_MS,
          "Timed out getting your location. Check that location services are enabled and try again."
        );
        if (requestIdRef.current !== requestId) return;
        setState(resolved({ lat: position.coords.latitude, lng: position.coords.longitude }));
      } catch {
        if (requestIdRef.current !== requestId) return;
        // A cached fix is already showing — don't replace it.
        if (lastKnown) return;
        setState({ coords: LISBON, errorMsg: null, loading: false, fallback: "off" });
      }
    })();
  }, [override]);

  useEffect(() => {
    load();
  }, [load]);

  // Someone who turned location on in Settings comes back to the app: pick it
  // up without needing a restart.
  const fallbackRef = useRef<LocationFallback | null>(null);
  fallbackRef.current = state.fallback;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && fallbackRef.current === "off") load();
    });
    return () => sub.remove();
  }, [load]);

  return { ...state, retry: load };
}
