import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { Product, Purchase } from "expo-iap";
import { useAuth } from "./AuthContext";
import { useLocale } from "./LocaleContext";
import { supabase } from "../lib/supabase";
import { fetchServerTime } from "../api/client";

// The exact product ID configured for this one-time, non-consumable unlock in
// both App Store Connect and Google Play Console. Must match on both sides.
export const PRO_PRODUCT_ID = "tanken_pro_unlock";

const STORAGE_KEY = "tanka:has-pro";
// Per-account local cache of that account's trial start — offline fallback
// only; the server (user_data.trial_started_at) is the source of truth.
const TRIAL_START_CACHE_PREFIX = "tanka:trial-start:";
// Highest server-verified wall-clock time this device has ever seen — a floor
// under "now" so rolling the device clock back can't revive an expired trial.
const TRIAL_SEEN_MAX_KEY = "tanka:trial-seen-max";
const TRIAL_DURATION_DAYS = 3;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

// expo-iap is a native module — like the other native modules in this app
// (Google Sign-In, notifications), it isn't present in Expo Go's binary and
// must be loaded conditionally so importing it there doesn't crash the app.
// It's also absent from any dev-client binary built before this module was
// added. expo-iap resolves its native binding lazily (only when a property
// is first accessed, inside an async call), so a plain try/catch around
// require("expo-iap") can't detect a missing binding — the throw happens
// later, inside a promise, as an unhandled rejection. Checking directly via
// requireOptionalNativeModule is the only way to know up front.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const nativeModuleAvailable = !isExpoGo && requireOptionalNativeModule("ExpoIap") !== null;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExpoIapModule = nativeModuleAvailable ? require("expo-iap") : null;

interface PurchaseContextValue {
  hasPro: boolean;
  hasPurchased: boolean;
  isSignedIn: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  priceLabel: string | null;
  purchasePro: () => void;
  restorePurchases: () => void;
  presentPaywall: (feature?: string) => void;
  dismissPaywall: () => void;
  paywallVisible: boolean;
  paywallFeature: string | null;
}

const PurchaseContext = createContext<PurchaseContextValue | undefined>(undefined);

function useSharedPaywallState() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  const presentPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature ?? null);
    setPaywallVisible(true);
  }, []);

  const dismissPaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  return { paywallVisible, paywallFeature, presentPaywall, dismissPaywall };
}

// The trial only exists for a signed-in account — it starts the moment a
// user first signs in and lives on their Supabase row, so switching devices,
// reinstalling the app, or signing out and back in can't reset or duplicate
// it. Signed-out users get no trial at all: Pro stays fully locked until they
// sign in (which starts it) or buy it outright. "Now" is anchored to the
// server clock plus a monotonic floor, so rolling the device clock back can't
// revive a used-up trial either.
function useTrialState() {
  const { token } = useAuth();
  const [trialStartAt, setTrialStartAt] = useState<number | null>(null);
  const [seenMax, setSeenMax] = useState(0);
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const [serverTimeConfirmed, setServerTimeConfirmed] = useState(false);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const [, forceRecheck] = useState(0);

  // The monotonic floor persists across restarts regardless of sign-in state.
  useEffect(() => {
    AsyncStorage.getItem(TRIAL_SEEN_MAX_KEY).then((raw) => {
      if (raw) setSeenMax(Number(raw));
    });
  }, []);

  // Anchor the clock to the server so a rolled-back device clock is corrected.
  useEffect(() => {
    fetchServerTime().then((serverNow) => {
      if (serverNow != null) {
        setClockSkewMs(serverNow - Date.now());
        setServerTimeConfirmed(true);
      }
    });
  }, []);

  // Advance the monotonic floor — but only with server-verified time, so a
  // device clock briefly set far into the future can't permanently kill it.
  useEffect(() => {
    if (!serverTimeConfirmed) return;
    setSeenMax((prev) => {
      const candidate = Date.now() + clockSkewMs;
      if (candidate > prev) {
        AsyncStorage.setItem(TRIAL_SEEN_MAX_KEY, String(candidate)).catch(() => undefined);
        return candidate;
      }
      return prev;
    });
  }, [serverTimeConfirmed, clockSkewMs]);

  // Signed out: no trial, nothing to load.
  // Signed in: read (or start) this account's trial from the server. Falls
  // back to a per-account local cache only if the server can't be reached
  // right after sign-in — it never invents a new start on its own.
  useEffect(() => {
    if (!token) {
      setTrialStartAt(null);
      setTrialLoaded(true);
      return;
    }
    let cancelled = false;
    setTrialLoaded(false);
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      const cacheKey = `${TRIAL_START_CACHE_PREFIX}${userId}`;

      try {
        const { data } = await supabase
          .from("user_data")
          .select("trial_started_at")
          .maybeSingle();
        if (cancelled) return;
        const raw = (data as { trial_started_at?: number | string | null } | null)
          ?.trial_started_at;
        let start = raw != null ? Number(raw) : null;
        if (start == null) {
          start = Date.now();
          await supabase.from("user_data").upsert({ user_id: userId, trial_started_at: start });
        }
        setTrialStartAt(start);
        await AsyncStorage.setItem(cacheKey, String(start));
      } catch {
        if (cancelled) return;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) setTrialStartAt(Number(cached));
      } finally {
        if (!cancelled) setTrialLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const trustedNow = () => Math.max(Date.now() + clockSkewMs, seenMax);
  const trialExpiresAt = trialStartAt != null ? trialStartAt + TRIAL_DURATION_MS : null;
  const trialActive = trialExpiresAt != null && trustedNow() < trialExpiresAt;
  const trialDaysLeft =
    trialExpiresAt != null
      ? Math.max(0, Math.ceil((trialExpiresAt - trustedNow()) / (24 * 60 * 60 * 1000)))
      : TRIAL_DURATION_DAYS;

  // Re-render once at the exact expiry moment so gated UI flips on time.
  useEffect(() => {
    if (trialExpiresAt == null) return;
    const remaining = trialExpiresAt - Math.max(Date.now() + clockSkewMs, seenMax);
    if (remaining <= 0) return;
    const timer = setTimeout(() => forceRecheck((n) => n + 1), remaining);
    return () => clearTimeout(timer);
  }, [trialExpiresAt, clockSkewMs, seenMax]);

  return { trialActive, trialDaysLeft, trialLoaded, isSignedIn: !!token };
}

// Real implementation — only ever mounted outside Expo Go, so it's safe for
// this to be the one place that actually calls into the native module.
function RealPurchaseProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const shared = useSharedPaywallState();
  const { trialActive, trialDaysLeft, trialLoaded, isSignedIn } = useTrialState();

  // useIAP's restorePurchases() only resolves once it's done, without
  // reporting whether anything was actually found — the result shows up
  // asynchronously as a state update instead. This ref lets the restore
  // handler below read the up-to-date value after that update lands, rather
  // than the stale one captured when the callback was created.
  const hasPurchasedRef = useRef(hasPurchased);
  useEffect(() => {
    hasPurchasedRef.current = hasPurchased;
  }, [hasPurchased]);

  const applyPurchases = useCallback((purchases: Purchase[]) => {
    const owned = purchases.some((p) => p.productId === PRO_PRODUCT_ID);
    if (owned) {
      setHasPurchased(true);
      AsyncStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const {
    connected,
    products,
    availablePurchases,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases: restorePurchasesInternal,
  } = ExpoIapModule.useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      if (purchase.productId === PRO_PRODUCT_ID) {
        await finishTransaction({ purchase, isConsumable: false });
        setHasPurchased(true);
        AsyncStorage.setItem(STORAGE_KEY, "true");
        shared.dismissPaywall();
      }
    },
    onPurchaseError: () => {
      // Silently ignored here (e.g. user cancellation) — nothing to recover.
    },
  });

  // Fast local read so the UI doesn't flash "locked" before the store
  // round-trip below completes.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === "true") setHasPurchased(true);
      })
      .finally(() => setCacheLoaded(true));
  }, []);

  // Source of truth: reconcile with the store once connected. Covers the
  // reinstall/new-device case where the local cache is empty but the
  // purchase is still owned.
  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [PRO_PRODUCT_ID], type: "in-app" }).catch(() => undefined);
    restorePurchasesInternal().catch(() => undefined);
  }, [connected, fetchProducts, restorePurchasesInternal]);

  useEffect(() => {
    if (availablePurchases.length > 0) applyPurchases(availablePurchases);
  }, [availablePurchases, applyPurchases]);

  const product: Product | undefined = products.find((p: Product) => p.id === PRO_PRODUCT_ID);

  const purchasePro = useCallback(() => {
    requestPurchase({
      request: {
        apple: { sku: PRO_PRODUCT_ID },
        google: { skus: [PRO_PRODUCT_ID] },
      },
      type: "in-app",
    }).catch(() => undefined);
  }, [requestPurchase]);

  const restorePurchases = useCallback(async () => {
    try {
      await restorePurchasesInternal();
      // Give the availablePurchases -> applyPurchases update a moment to land.
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (hasPurchasedRef.current) {
        Alert.alert(t("pro.restoreSuccessTitle"), t("pro.restoreSuccessMsg"));
      } else {
        Alert.alert(t("pro.restoreNoneTitle"), t("pro.restoreNoneMsg"));
      }
    } catch (err) {
      Alert.alert(
        t("pro.restoreErrorTitle"),
        `${t("pro.restoreErrorMsg")}\n\n${String((err as Error)?.message ?? err)}`
      );
    }
  }, [restorePurchasesInternal, t]);

  const value = useMemo(
    () => ({
      hasPro: hasPurchased || trialActive,
      hasPurchased,
      isSignedIn,
      trialActive,
      trialDaysLeft,
      loading: !cacheLoaded || !trialLoaded,
      priceLabel: product?.displayPrice ?? null,
      purchasePro,
      restorePurchases,
      ...shared,
    }),
    [
      hasPurchased,
      isSignedIn,
      trialActive,
      trialDaysLeft,
      cacheLoaded,
      trialLoaded,
      product,
      purchasePro,
      restorePurchases,
      shared,
    ]
  );

  return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>;
}

// Expo Go / stale-dev-client stand-in — no native module available, so
// purchasing just directs people to try it in a real build. The trial still
// runs here, so testing gated features doesn't require a rebuild; only the
// real purchase flow does.
function StubPurchaseProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const shared = useSharedPaywallState();
  const { trialActive, trialDaysLeft, trialLoaded, isSignedIn } = useTrialState();
  const restorePurchases = useCallback(() => {
    Alert.alert(t("pro.restoreUnavailableTitle"), t("pro.restoreUnavailable"));
  }, [t]);
  const value = useMemo(
    () => ({
      hasPro: trialActive,
      hasPurchased: false,
      isSignedIn,
      trialActive,
      trialDaysLeft,
      loading: !trialLoaded,
      priceLabel: null,
      purchasePro: () => undefined,
      restorePurchases,
      ...shared,
    }),
    [trialActive, trialDaysLeft, trialLoaded, isSignedIn, restorePurchases, shared]
  );
  return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>;
}

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  // ExpoIapModule is a stable module-level constant for the app's lifetime
  // (resolved once, above), so this always mounts the same branch — never
  // toggles between the two while the app is running.
  if (!ExpoIapModule) return <StubPurchaseProvider>{children}</StubPurchaseProvider>;
  return <RealPurchaseProvider>{children}</RealPurchaseProvider>;
}

export function usePurchase(): PurchaseContextValue {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used within a PurchaseProvider");
  return ctx;
}
