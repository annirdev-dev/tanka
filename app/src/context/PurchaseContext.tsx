import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { Product, Purchase } from "expo-iap";
import { useAuth } from "./AuthContext";
import { useLocale } from "./LocaleContext";
import { supabase } from "../lib/supabase";
import { confirmPurchase, fetchServerTime } from "../api/client";
import * as Notifications from "../lib/notifications";
import { TranslationKey } from "../i18n/translations";
import { TEST_TOOLS } from "../lib/testTools";

// The exact product ID configured for this one-time, non-consumable unlock in
// both App Store Connect and Google Play Console. Must match on both sides.
export const PRO_PRODUCT_ID = "tanka_pro_unlock";

const STORAGE_KEY = "tanka:has-pro";
// The store's transaction id for this device's Pro purchase — what the backend
// needs in order to verify the purchase with Apple.
const PRO_TRANSACTION_KEY = "tanka:pro-transaction";
// Apple's signed record of that purchase (StoreKit's JWS). Sent along as a
// backup the backend can verify by Apple's signature when Apple's own lookup
// API can't answer (e.g. production before the app's first release).
const PRO_SIGNED_KEY = "tanka:pro-signed-transaction";
// Per-account offline fallback for "the server says this account is Pro" — the
// server's user_data.has_pro is the source of truth; this only keeps Pro
// unlocked when it can't be reached (e.g. a launch with no connection).
const ACCOUNT_PRO_CACHE_PREFIX = "tanka:account-pro:";
// Per-account local cache of that account's trial start — offline fallback
// only; the server (user_data.trial_started_at) is the source of truth.
const TRIAL_START_CACHE_PREFIX = "tanka:trial-start:";
// Per-account, per-device flag so the "your trial has ended" notice only
// ever shows once — a fresh device seeing an already-expired trial (e.g.
// reinstall, new device) still gets it exactly once, just not "live".
const TRIAL_ENDED_SHOWN_PREFIX = "tanka:trial-ended-shown:";
// Highest server-verified wall-clock time this device has ever seen — a floor
// under "now" so rolling the device clock back can't revive an expired trial.
const TRIAL_SEEN_MAX_KEY = "tanka:trial-seen-max";
const TRIAL_DURATION_DAYS = 5;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
// How long before expiry to warn the user — scheduled as a real OS-level
// notification (not a "while the app is open" check), so it fires even if
// they never open the app again before the trial actually ends.
const TRIAL_REMINDER_HOURS_BEFORE = 3;
const TRIAL_REMINDER_MS = TRIAL_REMINDER_HOURS_BEFORE * 60 * 60 * 1000;
const TRIAL_REMINDER_CHANNEL_ID = "trial-reminder";
// Stores the scheduled notification's id (so it can be cancelled if the user
// buys Pro before it fires) — presence of the key at all means "already
// scheduled, don't schedule again".
const TRIAL_REMINDER_ID_PREFIX = "tanka:trial-reminder-id:";

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync(TRIAL_REMINDER_CHANNEL_ID, {
    name: "Trial reminders",
    importance: 4, // AndroidImportance.DEFAULT
  }).catch(() => undefined);
}

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
  // Forgets this device's local "owns Pro" note (used when the account is
  // deleted, so the app really starts over; Restore/Unlock brings it back
  // without a new charge because the Apple ID still owns the purchase).
  clearLocalPurchase: () => void;
  presentPaywall: (feature?: string) => void;
  dismissPaywall: () => void;
  paywallVisible: boolean;
  paywallFeature: string | null;
  // Bumps whenever the account's live-vs-delayed price entitlement changes on
  // the server (purchase recorded, trial ended or restarted), so screens that
  // already hold fetched prices know to load them again.
  entitlementVersion: number;
  // Test builds only (undefined otherwise): rewrites this account's trial
  // start to N days ago (6 = ended, 0 = fresh) on the server and locally.
  testSetTrialStart?: (startedDaysAgo: number) => Promise<void>;
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
function useTrialState(t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  const { token } = useAuth();
  const [trialStartAt, setTrialStartAt] = useState<number | null>(null);
  const [seenMax, setSeenMax] = useState(0);
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const [serverTimeConfirmed, setServerTimeConfirmed] = useState(false);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const [, forceRecheck] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [trialJustExpired, setTrialJustExpired] = useState(false);
  const [trialVersion, setTrialVersion] = useState(0);
  const trialWasActiveRef = useRef(false);

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
  // Signing in or out changes which prices the server hands out (live during
  // a trial or with Pro, delayed otherwise), so after the very first run —
  // app launch, when nothing has been fetched yet — each change in sign-in
  // state nudges the screens to reload.
  const tokenEffectRanRef = useRef(false);
  useEffect(() => {
    const signInChanged = tokenEffectRanRef.current;
    tokenEffectRanRef.current = true;
    if (!token) {
      setTrialStartAt(null);
      setUserId(null);
      setTrialLoaded(true);
      if (signInChanged) setTrialVersion((v) => v + 1);
      return;
    }
    let cancelled = false;
    setTrialLoaded(false);
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      setUserId(userId);
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
          // The server owns the trial start — it ignores the value sent here
          // and may even hand back an older one (an identity that already
          // used its trial) — so adopt whatever it stored, not our own clock.
          const { data: created } = await supabase
            .from("user_data")
            .upsert({ user_id: userId, trial_started_at: Date.now() })
            .select("trial_started_at")
            .single();
          const stored = (created as { trial_started_at?: number | string | null } | null)
            ?.trial_started_at;
          start = stored != null ? Number(stored) : Date.now();
        }
        setTrialStartAt(start);
        await AsyncStorage.setItem(cacheKey, String(start));
      } catch {
        if (cancelled) return;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) setTrialStartAt(Number(cached));
      } finally {
        if (!cancelled) {
          setTrialLoaded(true);
          if (signInChanged) setTrialVersion((v) => v + 1);
        }
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

  // The server flips this account to delayed prices the moment the trial ends;
  // tell the screens so they reload instead of showing stale live prices.
  useEffect(() => {
    if (trialWasActiveRef.current && !trialActive) setTrialVersion((v) => v + 1);
    trialWasActiveRef.current = trialActive;
  }, [trialActive]);

  // Re-render once at the exact expiry moment so gated UI flips on time.
  useEffect(() => {
    if (trialExpiresAt == null) return;
    const remaining = trialExpiresAt - Math.max(Date.now() + clockSkewMs, seenMax);
    if (remaining <= 0) return;
    const timer = setTimeout(() => forceRecheck((n) => n + 1), remaining);
    return () => clearTimeout(timer);
  }, [trialExpiresAt, clockSkewMs, seenMax]);

  // Fires exactly once per account per device — the moment this device
  // observes a real, started trial that's no longer active (whether that's
  // right as it expires, thanks to the re-render above, or the first time a
  // fresh install sees an already-expired one).
  useEffect(() => {
    if (!trialLoaded || !userId || trialStartAt == null || trialActive) return;
    let cancelled = false;
    const shownKey = `${TRIAL_ENDED_SHOWN_PREFIX}${userId}`;
    AsyncStorage.getItem(shownKey).then((raw) => {
      if (cancelled || raw === "true") return;
      AsyncStorage.setItem(shownKey, "true").catch(() => undefined);
      setTrialJustExpired(true);
    });
    return () => {
      cancelled = true;
    };
  }, [trialLoaded, userId, trialStartAt, trialActive]);

  // Schedules a real OS-level notification a few hours before the trial ends
  // — a one-time schedule per account per device, guarded by the presence of
  // the stored notification id (also lets a purchase cancel it later).
  useEffect(() => {
    if (!trialLoaded || !userId || trialExpiresAt == null || !trialActive) return;
    let cancelled = false;
    const idKey = `${TRIAL_REMINDER_ID_PREFIX}${userId}`;
    AsyncStorage.getItem(idKey).then(async (existing) => {
      if (cancelled || existing) return;
      const reminderAt = trialExpiresAt - TRIAL_REMINDER_MS;
      if (reminderAt <= trustedNow()) return; // too close to (or past) expiry to warn ahead of time
      await Notifications.requestPermissionsAsync().catch(() => undefined);
      const id = await Notifications.scheduleDateNotificationAsync(
        {
          title: t("trial.reminderTitle"),
          body: t("trial.reminderBody", { hours: TRIAL_REMINDER_HOURS_BEFORE }),
        },
        new Date(reminderAt),
        Platform.OS === "android" ? TRIAL_REMINDER_CHANNEL_ID : undefined
      );
      if (!cancelled && id) await AsyncStorage.setItem(idKey, id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialLoaded, userId, trialExpiresAt, trialActive]);

  // Test builds only (never wired to any UI otherwise). Moves the trial start
  // on the server — that's what is_user_pro() reads to decide live vs delayed
  // prices — then mirrors it locally and re-arms the one-time "trial ended"
  // notice so ending the trial shows the same paywall a real expiry would.
  // The database rejects client edits to the trial start, so this goes through
  // a function that only works for accounts on the test allow-list.
  const testSetTrialStart = useCallback(
    async (startedDaysAgo: number) => {
      if (!userId) throw new Error("Sign in first — the trial lives on your account.");
      const { data, error } = await supabase.rpc("test_set_trial_start", {
        p_days_ago: startedDaysAgo,
      });
      if (error) throw new Error(error.message);
      const start = Number(data);
      await AsyncStorage.setItem(`${TRIAL_START_CACHE_PREFIX}${userId}`, String(start));
      await AsyncStorage.removeItem(`${TRIAL_ENDED_SHOWN_PREFIX}${userId}`);
      setTrialJustExpired(false);
      setTrialStartAt(start);
      // Ending is picked up by the active -> inactive effect above; a restart
      // (inactive -> active) needs its own nudge.
      if (startedDaysAgo < TRIAL_DURATION_DAYS) setTrialVersion((v) => v + 1);
    },
    [userId]
  );

  return {
    trialActive,
    trialDaysLeft,
    trialLoaded,
    trialJustExpired,
    userId,
    isSignedIn: !!token,
    trialVersion,
    testSetTrialStart: TEST_TOOLS ? testSetTrialStart : undefined,
  };
}

// Real implementation — only ever mounted outside Expo Go, so it's safe for
// this to be the one place that actually calls into the native module.
function RealPurchaseProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const shared = useSharedPaywallState();
  const {
    trialActive,
    trialDaysLeft,
    trialLoaded,
    trialJustExpired,
    userId,
    isSignedIn,
    trialVersion,
    testSetTrialStart,
  } = useTrialState(t);
  const [purchaseVersion, setPurchaseVersion] = useState(0);
  // True when the signed-in account itself is Pro on the server — what makes
  // Pro survive a reinstall, a new device, or a different Apple ID, none of
  // which carry this device's local purchase cache.
  const [accountPro, setAccountPro] = useState(false);
  // Transaction id of the purchase to verify with Apple, once this device has
  // seen one (just bought, restored, or remembered from earlier).
  const [proTransactionId, setProTransactionId] = useState<string | null>(null);
  const proSignedRef = useRef<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(PRO_SIGNED_KEY).then((raw) => {
      if (raw) proSignedRef.current = raw;
    });
    AsyncStorage.getItem(PRO_TRANSACTION_KEY).then((raw) => {
      if (raw) setProTransactionId(raw);
    });
  }, []);
  const rememberTransaction = useCallback((purchase: Purchase) => {
    const id = (purchase as { transactionId?: string | null }).transactionId ?? purchase.id;
    if (!id) return;
    // On iOS the purchase token is StoreKit's signed record (three dot-
    // separated parts); keep it only if it really looks like one.
    const token = purchase.purchaseToken;
    if (typeof token === "string" && token.split(".").length === 3) {
      proSignedRef.current = token;
      AsyncStorage.setItem(PRO_SIGNED_KEY, token).catch(() => undefined);
    }
    setProTransactionId(id);
    AsyncStorage.setItem(PRO_TRANSACTION_KEY, id).catch(() => undefined);
  }, []);
  // Which account we've finished asking the server about, so the "your trial
  // ended" paywall never flashes up on a fresh install of an account that is
  // actually Pro, before the answer arrives.
  const [proCheckedFor, setProCheckedFor] = useState<string | null>(null);
  const proChecked = !userId || proCheckedFor === userId;
  // onPurchaseSuccess is registered once with the IAP hook, so it reads the
  // latest sign-in state through a ref rather than a stale closure.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Buying Pro makes the "trial about to end" reminder pointless (and
  // confusing) — cancel it if it's still pending.
  useEffect(() => {
    if (!hasPurchased || !userId) return;
    const idKey = `${TRIAL_REMINDER_ID_PREFIX}${userId}`;
    AsyncStorage.getItem(idKey).then((id) => {
      if (!id) return;
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
      AsyncStorage.removeItem(idKey).catch(() => undefined);
    });
  }, [hasPurchased, userId]);

  // Only for someone who hasn't already bought Pro outright — for them the
  // trial ending is moot, they already have full access.
  // NB: depends on `shared.presentPaywall` specifically (stable, useCallback
  // with no deps), not `shared` itself — that object is a fresh literal every
  // render, which would re-open the paywall on every unrelated re-render.
  const { presentPaywall: presentSharedPaywall } = shared;
  useEffect(() => {
    if (trialJustExpired && !hasPurchased && !accountPro && proChecked) {
      presentSharedPaywall("trialEnded");
    }
  }, [trialJustExpired, hasPurchased, accountPro, proChecked, presentSharedPaywall]);

  // useIAP's restorePurchases() only resolves once it's done, without
  // reporting whether anything was actually found — the result shows up
  // asynchronously as a state update instead. This ref lets the restore
  // handler below read the up-to-date value after that update lands, rather
  // than the stale one captured when the callback was created.
  const hasPurchasedRef = useRef(hasPurchased);
  useEffect(() => {
    hasPurchasedRef.current = hasPurchased || accountPro;
  }, [hasPurchased, accountPro]);

  const applyPurchases = useCallback(
    (purchases: Purchase[]) => {
      const owned = purchases.find((p) => p.productId === PRO_PRODUCT_ID);
      if (owned) {
        rememberTransaction(owned);
        setHasPurchased(true);
        AsyncStorage.setItem(STORAGE_KEY, "true");
      }
    },
    [rememberTransaction]
  );

  // The backend decides live vs delayed prices (and the route feature) from
  // the account's has_pro flag, so Pro has to live on the account, not just on
  // this device. Whenever an account is signed in:
  //  - the server already says Pro → unlock it here (this is what carries Pro
  //    across a reinstall or a new device);
  //  - the server says not Pro but this device owns it (just bought, restored,
  //    or bought while signed out) → record it on the account;
  //  - the server can't be reached → fall back to the last known answer.
  // Recording goes through the confirm-purchase Edge Function (service role),
  // since the database rejects a client-side has_pro write.
  useEffect(() => {
    if (!userId) {
      setAccountPro(false);
      return;
    }
    let cancelled = false;
    const cacheKey = `${ACCOUNT_PRO_CACHE_PREFIX}${userId}`;
    (async () => {
      let serverPro: boolean | null = null; // null = couldn't ask the server
      try {
        const { data, error } = await supabase.from("user_data").select("has_pro").maybeSingle();
        if (!error) serverPro = !!(data as { has_pro?: boolean } | null)?.has_pro;
      } catch {
        // offline — handled below
      }
      if (cancelled) return;
      if (serverPro === null) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cancelled) return;
        if (cached === "true") setAccountPro(true);
        setProCheckedFor(userId);
        return;
      }
      if (serverPro) {
        setAccountPro(true);
        setProCheckedFor(userId);
        AsyncStorage.setItem(cacheKey, "true").catch(() => undefined);
        return;
      }
      setAccountPro(false);
      setProCheckedFor(userId);
      AsyncStorage.removeItem(cacheKey).catch(() => undefined);
      // Nothing to record unless this device owns Pro AND we have the store's
      // transaction id for it — without that the backend can't verify it. (A
      // device that unlocked Pro before ids were kept gets one the next time
      // the purchase is restored.)
      if (!hasPurchased || !proTransactionId) return;
      try {
        await confirmPurchase(
          PRO_PRODUCT_ID,
          proTransactionId,
          Platform.OS,
          proSignedRef.current ?? undefined
        );
        setAccountPro(true);
        AsyncStorage.setItem(cacheKey, "true").catch(() => undefined);
        setPurchaseVersion((v) => v + 1);
      } catch (err) {
        if ((err as { code?: string }).code === "revoked") {
          // Apple refunded this purchase: lock Pro on this device too, so a
          // refunded buyer doesn't keep the local unlock. (Only this explicit
          // answer does it — a verification hiccup must never lock out a
          // paying customer.)
          AsyncStorage.multiRemove([STORAGE_KEY, PRO_TRANSACTION_KEY, PRO_SIGNED_KEY]).catch(
            () => undefined
          );
          proSignedRef.current = null;
          setHasPurchased(false);
          setProTransactionId(null);
          return;
        }
        console.error("Failed to record purchase server-side:", (err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasPurchased, userId, proTransactionId]);

  const {
    connected,
    products,
    availablePurchases,
    getAvailablePurchases,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases: restorePurchasesInternal,
  } = ExpoIapModule.useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      if (purchase.productId === PRO_PRODUCT_ID) {
        await finishTransaction({ purchase, isConsumable: false });
        rememberTransaction(purchase);
        setHasPurchased(true);
        AsyncStorage.setItem(STORAGE_KEY, "true");
        shared.dismissPaywall();
        // Signed out: nothing to attach the purchase to yet, so live prices
        // can't switch on until they sign in — say so instead of leaving them
        // looking at delayed prices after paying.
        if (!userIdRef.current) {
          Alert.alert(t("pro.signInToActivateTitle"), t("pro.signInToActivateMsg"));
        }
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

  // On iOS, restorePurchases() runs an App Store sync and even
  // getAvailablePurchases() raises an Apple sign-in sheet on a device without
  // an Apple ID, so launch only loads product info there; a reinstall/new
  // device recovers Pro through the user-initiated Restore button below.
  // Google Play's entitlement query is silent, so Android still reconciles at
  // launch.
  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [PRO_PRODUCT_ID], type: "in-app" }).catch(() => undefined);
    if (Platform.OS === "android") getAvailablePurchases().catch(() => undefined);
  }, [connected, fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (availablePurchases.length > 0) applyPurchases(availablePurchases);
  }, [availablePurchases, applyPurchases]);

  // A device that unlocked Pro before the store's transaction id was kept has
  // nothing to send the backend for verification, so while the signed-in
  // account isn't yet Pro on the server, ask the store for the entitlement
  // once. Only reached when this device already owns Pro (so it has an Apple
  // ID and the lookup is silent); the result lands in availablePurchases above,
  // which remembers the id and lets the check run again.
  useEffect(() => {
    if (Platform.OS !== "ios" || !connected) return;
    if (!userId || !proChecked || accountPro || !hasPurchased || proTransactionId) return;
    getAvailablePurchases().catch(() => undefined);
  }, [connected, userId, proChecked, accountPro, hasPurchased, proTransactionId, getAvailablePurchases]);

  const product: Product | undefined = products.find((p: Product) => p.id === PRO_PRODUCT_ID);

  const clearLocalPurchase = useCallback(() => {
    AsyncStorage.multiRemove([STORAGE_KEY, PRO_TRANSACTION_KEY, PRO_SIGNED_KEY]).catch(
      () => undefined
    );
    proSignedRef.current = null;
    setHasPurchased(false);
    setProTransactionId(null);
  }, []);

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
      hasPro: hasPurchased || accountPro || trialActive,
      hasPurchased: hasPurchased || accountPro,
      isSignedIn,
      trialActive,
      trialDaysLeft,
      loading: !cacheLoaded || !trialLoaded || !proChecked,
      priceLabel: product?.displayPrice || null,
      purchasePro,
      restorePurchases,
      clearLocalPurchase,
      entitlementVersion: purchaseVersion + trialVersion,
      testSetTrialStart,
      ...shared,
    }),
    [
      hasPurchased,
      isSignedIn,
      trialActive,
      trialDaysLeft,
      cacheLoaded,
      trialLoaded,
      proChecked,
      product,
      purchasePro,
      restorePurchases,
      clearLocalPurchase,
      accountPro,
      purchaseVersion,
      trialVersion,
      testSetTrialStart,
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
  const { trialActive, trialDaysLeft, trialLoaded, trialJustExpired, isSignedIn, trialVersion, testSetTrialStart } =
    useTrialState(t);
  const restorePurchases = useCallback(() => {
    Alert.alert(t("pro.restoreUnavailableTitle"), t("pro.restoreUnavailable"));
  }, [t]);

  const { presentPaywall: presentSharedPaywall } = shared;
  useEffect(() => {
    if (trialJustExpired) presentSharedPaywall("trialEnded");
  }, [trialJustExpired, presentSharedPaywall]);
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
      clearLocalPurchase: () => undefined,
      entitlementVersion: trialVersion,
      testSetTrialStart,
      ...shared,
    }),
    [trialActive, trialDaysLeft, trialLoaded, isSignedIn, restorePurchases, trialVersion, testSetTrialStart, shared]
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
