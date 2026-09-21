import { Linking, Platform } from "react-native";

export async function openDirections(lat: number, lng: number, label: string): Promise<void> {
  const encodedLabel = encodeURIComponent(label);
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${lat},${lng}&q=${encodedLabel}`
      : `google.navigation:q=${lat},${lng}`;
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const supported = await Linking.canOpenURL(url).catch(() => false);
  await Linking.openURL(supported ? url : fallback);
}
