import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import { useAuth } from "./AuthContext";
import { useFavorites } from "./FavoritesContext";
import { useAlarms, Alarm } from "./AlarmsContext";
import { supabase } from "../lib/supabase";
import * as Notifications from "../lib/notifications";
import { Station } from "../types/station";

const PUSH_DEBOUNCE_MS = 3_000;

// Lets the background price-alert job (server-side) reach this device even
// while the app is closed — only meaningful once signed in, since that job
// reads alarms from the same signed-in user_data row this token is attached to.
async function registerPushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (!granted) {
    if (!canAskAgain) return;
    const result = await Notifications.requestPermissionsAsync();
    if (!result.granted) return;
  }
  const pushToken = await Notifications.getExpoPushTokenAsync(projectId);
  if (!pushToken) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("user_data").upsert({ user_id: data.user.id, push_token: pushToken });
}

async function pushToServer(favorites: Record<string, Station>, alarms: Record<string, Alarm>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("user_data").upsert({
    user_id: data.user.id,
    favorites,
    alarms,
    updated_at: new Date().toISOString(),
  });
}

// Headless — mounted once near the app root. Pulls server data on sign-in and
// pushes local changes back up while signed in. No UI of its own.
export function SyncCoordinator(): null {
  const { token } = useAuth();
  const { favorites, replaceFavorites } = useFavorites();
  const { alarms, replaceAlarms } = useAlarms();
  const pulledForToken = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTokenRegisteredForToken = useRef<string | null>(null);

  // Register this device for background price-alert push notifications once
  // signed in. Silently does nothing pre-rebuild / in Expo Go / if permission
  // is denied — registerPushToken already guards each of those.
  useEffect(() => {
    if (!token || pushTokenRegisteredForToken.current === token) return;
    pushTokenRegisteredForToken.current = token;
    registerPushToken().catch(() => undefined);
  }, [token]);

  // Initial pull (or push, if the account has no data yet) right after sign-in.
  useEffect(() => {
    if (!token || pulledForToken.current === token) return;
    pulledForToken.current = token;

    supabase
      .from("user_data")
      .select("favorites, alarms")
      .maybeSingle()
      .then(({ data }) => {
        const remoteFavorites = (data?.favorites ?? {}) as Record<string, Station>;
        const remoteAlarms = (data?.alarms ?? {}) as Record<string, Alarm>;
        const hasRemoteData =
          Object.keys(remoteFavorites).length > 0 || Object.keys(remoteAlarms).length > 0;

        if (hasRemoteData) {
          replaceFavorites(remoteFavorites);
          replaceAlarms(remoteAlarms);
        } else {
          pushToServer(favorites, alarms);
        }
      });
    // Only re-run when the token itself changes — favorites/alarms/replace fns
    // are read at call time, not meant to retrigger this initial-sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounced push of any local change while signed in.
  useEffect(() => {
    if (!token || pulledForToken.current !== token) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushToServer(favorites, alarms);
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [token, favorites, alarms]);

  useEffect(() => {
    if (!token) {
      pulledForToken.current = null;
      pushTokenRegisteredForToken.current = null;
    }
  }, [token]);

  return null;
}
