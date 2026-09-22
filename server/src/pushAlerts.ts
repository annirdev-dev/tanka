import fetch from "node-fetch";
import { FUEL_NAMES, FuelType } from "./apiAberta";
import { getStationById } from "./stationCatalog";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Mirrors the client's cooldown window so an alarm doesn't get a foreground
// notification and then a duplicate push (or vice versa) within the same window.
const RENOTIFY_INTERVAL_MS = 6 * 60 * 60_000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Must match the channel the client creates when scheduling alarms — without
// it, a background push on Android lands in the default (low-importance)
// channel and won't show a heads-up banner or play a sound.
const ANDROID_CHANNEL_ID = "price-alerts";

interface Alarm {
  stationId: string;
  stationName: string;
  fuelType: FuelType;
  targetPrice: number;
  priceWhenSet: number;
  lastNotifiedAt?: number;
}

interface UserDataRow {
  user_id: string;
  alarms: Record<string, Alarm> | null;
  push_token: string | null;
}

export interface AlertRunSummary {
  ok: boolean;
  reason?: string;
  usersWithAlarms: number;
  stationsChecked: number;
  pushSent: number;
  pushErrors: string[];
  staleTokensCleared: number;
}

// A run is near-instant (prices come from the already-synced local catalog,
// not a live upstream call), but the guard still avoids two overlapping runs
// both reading the same alarms and double-sending before either writes
// lastNotifiedAt back.
let running = false;

// Checks every signed-in user's price alarms against the last synced station
// catalog and pushes a notification for anything that's dropped to target —
// this is what lets an alarm fire even while the app is completely closed.
// Prices only actually change once a day (API Aberta / DGEG update cadence),
// so running this more often than that is free — it just re-checks the same
// snapshot until the next sync lands.
export async function checkPriceAlertsAndNotify(): Promise<AlertRunSummary> {
  const summary: AlertRunSummary = {
    ok: false,
    usersWithAlarms: 0,
    stationsChecked: 0,
    pushSent: 0,
    pushErrors: [],
    staleTokensCleared: 0,
  };

  if (running) {
    summary.ok = true;
    summary.reason = "another run is already in progress";
    return summary;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    summary.reason = "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured";
    return summary;
  }

  running = true;
  try {
    return await runCheck(supabase, summary);
  } finally {
    running = false;
  }
}

async function runCheck(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  summary: AlertRunSummary
): Promise<AlertRunSummary> {
  const { data, error } = await supabase
    .from("user_data")
    .select("user_id, alarms, push_token")
    .not("push_token", "is", null);

  if (error) {
    console.error("Price-alert job: failed to load alarms:", error.message);
    summary.reason = `failed to load alarms: ${error.message}`;
    return summary;
  }

  const rows = ((data ?? []) as UserDataRow[]).filter(
    (row) => row.push_token && row.alarms && Object.keys(row.alarms).length > 0
  );
  summary.usersWithAlarms = rows.length;
  if (rows.length === 0) {
    summary.ok = true;
    summary.reason = "no signed-in users have alarms + a push token";
    return summary;
  }

  const stationIds = new Set<string>();
  for (const row of rows) {
    for (const alarm of Object.values(row.alarms!)) stationIds.add(alarm.stationId);
  }
  summary.stationsChecked = stationIds.size;

  const now = Date.now();
  const messages: {
    to: string;
    title: string;
    body: string;
    sound: "default";
    priority: "high";
    channelId: string;
  }[] = [];
  // Parallel to `messages`: which alarm each one is for, so the cooldown is
  // stamped only on the ones Expo actually accepts.
  const messageTargets: { userId: string; alarmKey: string; token: string }[] = [];
  // Per-user working copy of the alarms blob; only written back if it changed.
  const nextAlarmsByUser = new Map<string, Record<string, Alarm>>();
  const dirtyUsers = new Set<string>();
  const nextAlarmsFor = (userId: string, current: Record<string, Alarm>) => {
    let next = nextAlarmsByUser.get(userId);
    if (!next) {
      next = { ...current };
      nextAlarmsByUser.set(userId, next);
    }
    return next;
  };

  for (const row of rows) {
    for (const [key, alarm] of Object.entries(row.alarms!)) {
      const station = getStationById(alarm.stationId);
      if (!station) continue;
      const price = station[alarm.fuelType];
      if (price === null) continue;

      const triggered = price <= alarm.targetPrice;
      const recentlyNotified =
        alarm.lastNotifiedAt !== undefined && now - alarm.lastNotifiedAt < RENOTIFY_INTERVAL_MS;

      if (triggered && !recentlyNotified) {
        messages.push({
          to: row.push_token!,
          title: `${alarm.stationName}: alerta de preço`,
          body: `${FUEL_NAMES[alarm.fuelType]} está agora a ${price.toFixed(3)} € (alvo ${alarm.targetPrice.toFixed(3)} €)`,
          sound: "default",
          priority: "high",
          channelId: ANDROID_CHANNEL_ID,
        });
        messageTargets.push({ userId: row.user_id, alarmKey: key, token: row.push_token! });
      } else if (!triggered && alarm.lastNotifiedAt !== undefined) {
        // Price rose back above target — clear so a future dip notifies again.
        const next = nextAlarmsFor(row.user_id, row.alarms!);
        next[key] = { ...alarm, lastNotifiedAt: undefined };
        dirtyUsers.add(row.user_id);
      }
    }
  }

  if (messages.length > 0) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const result = (await res.json()) as {
        data?: { status: string; message?: string; details?: { error?: string } }[];
      };
      const staleTokens = new Set<string>();
      const rowByUser = new Map(rows.map((r) => [r.user_id, r]));
      result.data?.forEach((entry, i) => {
        const target = messageTargets[i];
        if (!target) return;
        if (entry.status === "ok") {
          summary.pushSent += 1;
          // Burn the cooldown only now that the send was accepted.
          const row = rowByUser.get(target.userId)!;
          const next = nextAlarmsFor(target.userId, row.alarms!);
          const base = next[target.alarmKey] ?? row.alarms![target.alarmKey];
          next[target.alarmKey] = { ...base, lastNotifiedAt: now };
          dirtyUsers.add(target.userId);
        } else {
          summary.pushErrors.push(entry.details?.error || entry.message || "unknown push error");
          if (entry.details?.error === "DeviceNotRegistered") staleTokens.add(target.token);
        }
      });
      for (const token of staleTokens) {
        await supabase.from("user_data").update({ push_token: null }).eq("push_token", token);
        summary.staleTokensCleared += 1;
      }
    } catch (err) {
      console.error("Price-alert job: failed to send push notifications:", (err as Error).message);
      summary.pushErrors.push((err as Error).message);
    }
  }

  for (const userId of dirtyUsers) {
    const alarms = nextAlarmsByUser.get(userId);
    if (!alarms) continue;
    const { error: updateError } = await supabase
      .from("user_data")
      .update({ alarms })
      .eq("user_id", userId);
    if (updateError) {
      console.error("Price-alert job: failed to persist alarm state:", updateError.message);
    }
  }

  summary.ok = true;
  return summary;
}
