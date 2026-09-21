// Shared Android dark-mode map style — Apple Maps (iOS) already respects
// userInterfaceStyle natively, but react-native-maps on Android needs an
// explicit style array. Kept in one place so every screen with a map stays
// visually consistent.
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1720" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#242426" }] },
];
