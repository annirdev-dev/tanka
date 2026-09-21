import { Linking, Platform, Share } from "react-native";

// The Play Store listing URL works today — the package id is fixed. The App
// Store URL only exists once the app is live in App Store Connect; paste it
// here then (e.g. "https://apps.apple.com/app/id0000000000"). Until it's set,
// the iOS "open the store page" fallback is skipped — the native in-app
// rating prompt does not need it.
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.tanken.app";
export const APP_STORE_URL = "https://apps.apple.com/app/id6811379595";

// expo-store-review resolves its native module eagerly on import, so a build
// made before this package was added throws right here. Swallow it — every
// function below then simply no-ops until the app is rebuilt.
let StoreReview: typeof import("expo-store-review") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StoreReview = require("expo-store-review");
} catch {
  StoreReview = null;
}

function storeUrl(): string {
  if (Platform.OS === "ios") return APP_STORE_URL;
  return PLAY_URL;
}

// Shows the OS's native in-app rating card when it's allowed to appear;
// otherwise opens the public store page (Android always works; iOS only once
// APP_STORE_URL is filled in). Resolves to true if it surfaced anything.
export async function requestAppReview(): Promise<boolean> {
  try {
    if (StoreReview && (await StoreReview.isAvailableAsync())) {
      await StoreReview.requestReview();
      return true;
    }
  } catch {
    // fall through to the plain store link
  }
  return openStoreListing();
}

export async function openStoreListing(): Promise<boolean> {
  const url = storeUrl();
  if (!url) return false;
  await Linking.openURL(url).catch(() => undefined);
  return true;
}

export function shareApp(message: string): Promise<unknown> {
  const url = Platform.OS === "ios" && APP_STORE_URL ? APP_STORE_URL : PLAY_URL;
  return Share.share({ message: `${message}\n${url}` }).catch(() => undefined);
}
