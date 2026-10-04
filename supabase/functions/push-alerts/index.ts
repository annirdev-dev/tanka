import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions, requireCronAuth } from "../_shared/cors.ts";
import { FuelType } from "../_shared/station.ts";
import { chunk, isProRow, isStationId } from "../_shared/validate.ts";

const RENOTIFY_INTERVAL_MS = 6 * 60 * 60_000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ANDROID_CHANNEL_ID = "price-alerts";
// Expo accepts at most 100 messages per request.
const EXPO_BATCH_SIZE = 100;
// Alerts are a handful per person; the rest of an oversized list is ignored.
const MAX_ALARMS_PER_USER = 50;
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]{1,120}\]$/;

const FUEL_NAMES: Record<FuelType, string> = {
  gasoline_95: "Gasolina simples 95",
  gasoline_95_plus: "Gasolina especial 95",
  gasoline_98: "Gasolina 98",
  gasoline_98_plus: "Gasolina especial 98",
  diesel: "Gasóleo simples",
  diesel_plus: "Gasóleo especial",
  gpl_auto: "GPL Auto",
};

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
  has_pro: boolean | null;
  trial_started_at: number | string | null;
}

// The alarms JSON is written by the phone (and could be written by anyone with
// an account), so nothing in it is trusted: unknown fuels, odd ids and
// nonsense prices are skipped, and the station name that ends up in a
// notification is cut to a sane length with control characters removed.
function validAlarms(alarms: Record<string, Alarm>): [string, Alarm][] {
  const out: [string, Alarm][] = [];
  for (const [key, alarm] of Object.entries(alarms)) {
    if (out.length >= MAX_ALARMS_PER_USER) break;
    if (!alarm || typeof alarm !== "object") continue;
    if (!isStationId(alarm.stationId)) continue;
    if (!(alarm.fuelType in FUEL_NAMES)) continue;
    if (!Number.isFinite(alarm.targetPrice) || alarm.targetPrice <= 0 || alarm.targetPrice > 20) continue;
    out.push([key, alarm]);
  }
  return out;
}

function cleanName(name: unknown): string {
  // deno-lint-ignore no-control-regex
  return String(name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60) || "Posto";
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const forbidden = requireCronAuth(req);
  if (forbidden) return forbidden;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const summary = {
    ok: false,
    reason: undefined as string | undefined,
    usersWithAlarms: 0,
    stationsChecked: 0,
    pushSent: 0,
    pushErrors: [] as string[],
    staleTokensCleared: 0,
  };
  const finish = () => {
    console.log("push-alerts summary", JSON.stringify(summary));
    return jsonResponse(summary);
  };

  const { data, error } = await supabase
    .from("user_data")
    .select("user_id, alarms, push_token, has_pro, trial_started_at")
    .not("push_token", "is", null);

  if (error) {
    summary.reason = `failed to load alarms: ${error.message}`;
    return finish();
  }

  const now = Date.now();
  // Price alerts are a Pro feature, enforced here and not only in the app:
  // someone who is neither Pro nor in their trial gets none, whatever they
  // wrote into their own row.
  const rows = ((data ?? []) as UserDataRow[]).filter(
    (row) =>
      row.push_token &&
      EXPO_TOKEN.test(row.push_token) &&
      row.alarms &&
      typeof row.alarms === "object" &&
      Object.keys(row.alarms).length > 0 &&
      isProRow(row, now)
  );
  summary.usersWithAlarms = rows.length;
  if (rows.length === 0) {
    summary.ok = true;
    summary.reason = "no Pro/trial users have alarms + a push token";
    return finish();
  }

  const alarmsByUser = new Map<string, [string, Alarm][]>();
  const stationIds = new Set<string>();
  for (const row of rows) {
    const list = validAlarms(row.alarms!);
    alarmsByUser.set(row.user_id, list);
    for (const [, alarm] of list) stationIds.add(alarm.stationId);
  }
  summary.stationsChecked = stationIds.size;

  const { data: stationRows, error: stationsError } = await supabase
    .from("stations")
    .select("id, gasoline_95, gasoline_95_plus, gasoline_98, gasoline_98_plus, diesel, diesel_plus, gpl_auto")
    .in("id", Array.from(stationIds));
  if (stationsError) {
    summary.reason = `failed to load station prices: ${stationsError.message}`;
    return finish();
  }
  const stationById = new Map((stationRows ?? []).map((s) => [s.id as string, s]));

  const messages: {
    to: string;
    title: string;
    body: string;
    sound: "default";
    priority: "high";
    channelId: string;
  }[] = [];
  const messageTargets: { userId: string; alarmKey: string; token: string }[] = [];
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
    for (const [key, alarm] of alarmsByUser.get(row.user_id) ?? []) {
      const station = stationById.get(alarm.stationId);
      if (!station) continue;
      const price = station[alarm.fuelType] as number | null;
      if (price === null) continue;

      const triggered = price <= alarm.targetPrice;
      const recentlyNotified =
        alarm.lastNotifiedAt !== undefined && now - alarm.lastNotifiedAt < RENOTIFY_INTERVAL_MS;

      if (triggered && !recentlyNotified) {
        messages.push({
          to: row.push_token!,
          title: `${cleanName(alarm.stationName)}: alerta de preço`,
          body: `${FUEL_NAMES[alarm.fuelType]} está agora a ${price.toFixed(3)} € (alvo ${alarm.targetPrice.toFixed(3)} €)`,
          sound: "default",
          priority: "high",
          channelId: ANDROID_CHANNEL_ID,
        });
        messageTargets.push({ userId: row.user_id, alarmKey: key, token: row.push_token! });
      } else if (!triggered && alarm.lastNotifiedAt !== undefined) {
        const next = nextAlarmsFor(row.user_id, row.alarms!);
        next[key] = { ...alarm, lastNotifiedAt: undefined };
        dirtyUsers.add(row.user_id);
      }
    }
  }

  if (messages.length > 0) {
    const staleTokens = new Set<string>();
    const rowByUser = new Map(rows.map((r) => [r.user_id, r]));
    // One request per 100 messages; a failed batch is reported and the rest
    // still go out. Results come back in the same order as the messages sent.
    let offset = 0;
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      const batchStart = offset;
      offset += batch.length;
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(batch),
        });
        const result = (await res.json()) as {
          data?: { status: string; message?: string; details?: { error?: string } }[];
        };
        if (!Array.isArray(result.data)) {
          summary.pushErrors.push(`push service replied ${res.status} without results`);
          continue;
        }
        result.data.forEach((entry, i) => {
          const target = messageTargets[batchStart + i];
          if (!target) return;
          if (entry.status === "ok") {
            summary.pushSent += 1;
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
      } catch (err) {
        summary.pushErrors.push((err as Error).message);
      }
    }
    for (const token of staleTokens) {
      await supabase.from("user_data").update({ push_token: null }).eq("push_token", token);
      summary.staleTokensCleared += 1;
    }
  }

  for (const userId of dirtyUsers) {
    const alarms = nextAlarmsByUser.get(userId);
    if (!alarms) continue;
    const { error: updateError } = await supabase.from("user_data").update({ alarms }).eq("user_id", userId);
    if (updateError) console.error("push-alerts: failed to persist alarm state:", updateError.message);
  }

  summary.ok = true;
  return finish();
});
