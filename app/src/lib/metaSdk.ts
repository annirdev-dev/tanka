import { Platform } from "react-native";

// Starts Meta's SDK so Meta can count installs and app opens that come from
// Tanka ads (SKAdNetwork). iPhone only: the Android build does not include it.
// The SDK is optional by design — if it is missing or fails to start, the app
// carries on as normal.
export function startMetaSdk(): void {
  if (Platform.OS !== "ios") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Settings } = require("react-native-fbsdk-next");
    Settings.initializeSDK();
  } catch {
    // never let measurement break the app
  }
}
