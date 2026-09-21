import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "../lib/notifications";
import { FuelType, Station } from "../types/station";

const PRICE_ALERT_CHANNEL_ID = "price-alerts";

const STORAGE_KEY = "tanken:alarms";
const SAVINGS_STORAGE_KEY = "tanken:savings";
// Re-notifying for the same still-triggered alarm on every foreground data
// refresh would spam the user — space repeat alerts out by this much.
const RENOTIFY_INTERVAL_MS = 6 * 60 * 60_000;
// Unbounded growth would slowly bloat AsyncStorage for a purely cosmetic stat.
const MAX_SAVINGS_EVENTS = 200;

export type AlarmFuelType = Exclude<FuelType, "all">;

export interface Alarm {
  stationId: string;
  stationName: string;
  fuelType: AlarmFuelType;
  targetPrice: number;
  // The price at the moment the alert was set — the baseline the savings
  // tracker compares against when the alert later triggers.
  priceWhenSet: number;
  lastNotifiedAt?: number;
}

export interface SavingsEvent {
  id: string;
  stationName: string;
  fuelType: AlarmFuelType;
  priceWhenSet: number;
  triggerPrice: number;
  savedPerLiter: number;
  timestamp: number;
}

interface AlarmsContextValue {
  alarms: Record<string, Alarm>;
  savingsEvents: SavingsEvent[];
  getAlarm: (stationId: string) => Alarm | undefined;
  setAlarm: (
    stationId: string,
    stationName: string,
    fuelType: AlarmFuelType,
    targetPrice: number,
    priceWhenSet: number
  ) => void;
  clearAlarm: (stationId: string) => void;
  clearAllAlarms: () => void;
  clearSavings: () => void;
  replaceAlarms: (alarms: Record<string, Alarm>) => void;
  checkAndNotify: (stations: Station[]) => void;
}

const AlarmsContext = createContext<AlarmsContextValue | undefined>(undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android 8+ requires every notification to belong to a channel — without
// creating one explicitly, the OS falls back to a default/low-importance
// channel that can silently skip the heads-up banner entirely.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync(PRICE_ALERT_CHANNEL_ID, {
    name: "Price alerts",
    importance: 6, // AndroidImportance.HIGH — shows as a heads-up banner with sound
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => undefined);
}

function priceFor(station: Station, fuelType: AlarmFuelType): number | null {
  if (fuelType === "e5") return station.e5;
  if (fuelType === "e10") return station.e10;
  return station.diesel;
}

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Record<string, Alarm>>({});
  const [savingsEvents, setSavingsEvents] = useState<SavingsEvent[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SAVINGS_STORAGE_KEY)])
      .then(([rawAlarms, rawSavings]) => {
        if (rawAlarms) setAlarms(JSON.parse(rawAlarms));
        if (rawSavings) setSavingsEvents(JSON.parse(rawSavings));
      })
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(SAVINGS_STORAGE_KEY, JSON.stringify(savingsEvents));
  }, [savingsEvents]);

  const getAlarm = (stationId: string) => alarms[stationId];

  const setAlarm = (
    stationId: string,
    stationName: string,
    fuelType: AlarmFuelType,
    targetPrice: number,
    priceWhenSet: number
  ) => {
    Notifications.requestPermissionsAsync().catch(() => undefined);
    setAlarms((prev) => ({
      ...prev,
      [stationId]: { stationId, stationName, fuelType, targetPrice, priceWhenSet },
    }));
  };

  const clearAlarm = (stationId: string) => {
    setAlarms((prev) => {
      const next = { ...prev };
      delete next[stationId];
      return next;
    });
  };

  const clearAllAlarms = () => setAlarms({});
  const clearSavings = () => setSavingsEvents([]);
  const replaceAlarms = (next: Record<string, Alarm>) => setAlarms(next);

  // Only ever called with data the app already fetched on-demand for another
  // screen (nearby list, favorites refresh) — never triggers its own network call.
  const checkAndNotify = (stations: Station[]) => {
    const now = Date.now();
    let changed = false;
    const next = { ...alarms };
    const newSavings: SavingsEvent[] = [];

    for (const station of stations) {
      const alarm = next[station.id];
      if (!alarm) continue;
      const price = priceFor(station, alarm.fuelType);
      if (price === null) continue;

      const triggered = price <= alarm.targetPrice;
      const recentlyNotified =
        alarm.lastNotifiedAt !== undefined && now - alarm.lastNotifiedAt < RENOTIFY_INTERVAL_MS;

      if (triggered && !recentlyNotified) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${alarm.stationName}: price alert`,
            body: `${alarm.fuelType.toUpperCase()} is now ${price.toFixed(3)} € (target ${alarm.targetPrice.toFixed(3)} €)`,
          },
          trigger: Platform.OS === "android" ? { channelId: PRICE_ALERT_CHANNEL_ID } : null,
        }).catch(() => undefined);
        // Record the saving only on the first notification of a triggered
        // episode (lastNotifiedAt still unset) — not on the 6-hourly repeat
        // notifications, which would otherwise stack duplicate entries for one
        // sustained price drop and inflate the total. The `else if` below
        // clears lastNotifiedAt once the price rises back above target, so the
        // next dip counts as a fresh episode.
        const firstTrigger = alarm.lastNotifiedAt === undefined;

        next[station.id] = { ...alarm, lastNotifiedAt: now };
        changed = true;

        if (firstTrigger && price < alarm.priceWhenSet) {
          newSavings.push({
            id: `${station.id}-${now}`,
            stationName: alarm.stationName,
            fuelType: alarm.fuelType,
            priceWhenSet: alarm.priceWhenSet,
            triggerPrice: price,
            savedPerLiter: alarm.priceWhenSet - price,
            timestamp: now,
          });
        }
      } else if (!triggered && alarm.lastNotifiedAt !== undefined) {
        // Price rose back above target — clear so a future dip notifies again.
        next[station.id] = { ...alarm, lastNotifiedAt: undefined };
        changed = true;
      }
    }

    if (changed) setAlarms(next);
    if (newSavings.length > 0) {
      setSavingsEvents((prev) => [...newSavings, ...prev].slice(0, MAX_SAVINGS_EVENTS));
    }
  };

  const value = useMemo(
    () => ({
      alarms,
      savingsEvents,
      getAlarm,
      setAlarm,
      clearAlarm,
      clearAllAlarms,
      clearSavings,
      replaceAlarms,
      checkAndNotify,
    }),
    [alarms, savingsEvents]
  );

  return <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>;
}

export function useAlarms(): AlarmsContextValue {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error("useAlarms must be used within an AlarmsProvider");
  return ctx;
}
