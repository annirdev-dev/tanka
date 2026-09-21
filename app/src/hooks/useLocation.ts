import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { useLocationOverride } from "../context/LocationOverrideContext";

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

interface LocationState {
  coords: { lat: number; lng: number } | null;
  errorMsg: string | null;
  loading: boolean;
  retry: () => void;
}

export function useLocation(): LocationState {
  const { override } = useLocationOverride();
  const [state, setState] = useState<Omit<LocationState, "retry">>({
    coords: null,
    errorMsg: null,
    loading: true,
  });
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    // A manual override (set in Settings) bypasses the OS location APIs
    // entirely — sidesteps real-device GPS/mock-provider flakiness altogether.
    if (override) {
      requestIdRef.current++;
      setState({ coords: { lat: override.lat, lng: override.lng }, errorMsg: null, loading: false });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true }));

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (requestIdRef.current !== requestId) return;
      if (status !== "granted") {
        setState({ coords: null, errorMsg: "Location permission denied", loading: false });
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
        setState({
          coords: { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude },
          errorMsg: null,
          loading: false,
        });
      }

      try {
        const position = await withTimeout(
          Location.getCurrentPositionAsync({}),
          LOCATION_TIMEOUT_MS,
          "Timed out getting your location. Check that location services are enabled and try again."
        );
        if (requestIdRef.current !== requestId) return;
        setState({
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
          errorMsg: null,
          loading: false,
        });
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        // A cached fix is already showing — don't replace it with an error.
        if (lastKnown) return;
        setState({ coords: null, errorMsg: (err as Error).message, loading: false });
      }
    })();
  }, [override]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
}
