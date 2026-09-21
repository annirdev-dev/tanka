import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLocation } from "../hooks/useLocation";
import { useNearbyStations } from "../hooks/useNearbyStations";
import { useStationFilters, MAX_RADIUS_KM } from "../context/StationFiltersContext";
import { useAlarms } from "../context/AlarmsContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { FuelTypeFilter } from "../components/FuelTypeFilter";
import { OpenNowToggle } from "../components/OpenNowToggle";
import { StationInfoPanel } from "../components/StationInfoPanel";
import { displayPrice, formatPrice } from "../utils/price";
import { buildPriceRanks } from "../utils/priceTier";
import { DARK_MAP_STYLE } from "../utils/mapStyle";
import { radii, spacing, ColorScheme } from "../theme";
import { RootStackParamList, TabParamList } from "../navigation/types";
import { Station } from "../types/station";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Map">,
  NativeStackScreenProps<RootStackParamList>
>;

export function MapScreen({ navigation }: Props) {
  const { coords, errorMsg, loading: locationLoading, retry: retryLocation } = useLocation();
  const { fuelType, setFuelType, openNowOnly, setOpenNowOnly } = useStationFilters();
  const { stations, loading: stationsLoading, error: stationsError, refresh } = useNearbyStations(
    coords,
    { type: fuelType, rad: MAX_RADIUS_KM }
  );
  const [selected, setSelected] = useState<Station | null>(null);
  const { checkAndNotify } = useAlarms();
  const { colors, resolvedScheme } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tierColor = { cheap: colors.cheap, mid: colors.mid, expensive: colors.expensive };
  const mapRef = useRef<MapView>(null);

  // MapView's initialRegion only positions the camera on first mount — if the
  // resolved location changes afterward (e.g. a test-location override, or a
  // slow real GPS fix arriving after an initial fallback), the camera would
  // otherwise silently stay put while the data updates off-screen.
  useEffect(() => {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 },
      500
    );
  }, [coords?.lat, coords?.lng]);

  useEffect(() => {
    if (stations.length > 0) checkAndNotify(stations);
    // checkAndNotify is stable per alarms state and would cause a refire loop if included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  const visible = useMemo(
    () => (openNowOnly ? stations.filter((s) => s.isOpen) : stations),
    [stations, openNowOnly]
  );

  const tiers = useMemo(
    () => buildPriceRanks(visible.map((s) => displayPrice(s, fuelType))),
    [visible, fuelType]
  );

  if (locationLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (errorMsg || !coords) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>{errorMsg ?? t("map.locationUnavailable")}</Text>
        <Pressable style={styles.retryButton} onPress={retryLocation}>
          <Text style={styles.retryButtonText}>{t("map.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filtersSection}>
        <View style={styles.fuelTypeRow}>
          <FuelTypeFilter value={fuelType} onChange={setFuelType} />
        </View>
        <View style={styles.filterRow2}>
          <OpenNowToggle value={openNowOnly} onChange={setOpenNowOnly} />
          <Pressable style={styles.onMyWayPill} onPress={() => navigation.navigate("OnMyWay")}>
            <Ionicons name="navigate-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.onMyWayPillText}>{t("map.onMyWay")}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          userInterfaceStyle={resolvedScheme}
          customMapStyle={Platform.OS === "android" && resolvedScheme === "dark" ? DARK_MAP_STYLE : []}
          initialRegion={{
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          showsUserLocation
          // Android's built-in "my location" button collides with our own
          // refresh button and with the Google logo — we already re-center
          // on the user automatically, so there's no need for it.
          showsMyLocationButton={false}
        >
          {visible.map((station, index) => {
            const tier = tiers.get(index) ?? "mid";
            const pinColor = station.isOpen ? tierColor[tier] : colors.closed;
            return (
              <Marker
                key={station.id}
                coordinate={{ latitude: station.lat, longitude: station.lng }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelected(station);
                }}
              >
                <View style={styles.pinWrap}>
                  <View
                    style={[
                      styles.pin,
                      { backgroundColor: pinColor },
                      selected?.id === station.id && styles.pinSelected,
                    ]}
                  >
                    <Text style={styles.pinText}>{formatPrice(displayPrice(station, fuelType))}</Text>
                  </View>
                  <View style={[styles.pinArrow, { borderTopColor: pinColor }]} />
                </View>
              </Marker>
            );
          })}
        </MapView>

        <Pressable
          style={styles.refreshButton}
          onPress={refresh}
          disabled={stationsLoading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("map.refresh")}
        >
          {stationsLoading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.textPrimary} />
          )}
        </Pressable>

        {stationsLoading && visible.length === 0 && (
          <View style={styles.statusBanner} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.statusBannerText}>{t("map.loadingStations")}</Text>
          </View>
        )}

        {!stationsLoading && stationsError && visible.length === 0 && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{t("map.loadError")}</Text>
            <Text style={styles.statusBannerRetry} onPress={refresh}>
              {t("map.retry")}
            </Text>
          </View>
        )}
      </View>

      {selected && (
        <StationInfoPanel
          station={selected}
          fuelType={fuelType}
          onClose={() => setSelected(null)}
          onOpenDetail={() =>
            navigation.navigate("StationDetail", { stationId: selected.id, station: selected })
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: spacing.md },
    centerText: { textAlign: "center", color: colors.textPrimary },
    retryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    retryButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 14 },
    filtersSection: {
      backgroundColor: colors.background,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
      zIndex: 1,
    },
    fuelTypeRow: { paddingHorizontal: spacing.lg },
    filterRow2: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
    onMyWayPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.pillInactive,
      borderWidth: 1,
      borderColor: colors.pillInactive,
    },
    onMyWayPillText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    mapArea: { flex: 1 },
    map: { flex: 1 },
    statusBanner: {
      position: "absolute",
      top: spacing.md,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    statusBannerText: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
    statusBannerRetry: { fontSize: 13, color: colors.accent, fontWeight: "700" },
    refreshButton: {
      position: "absolute",
      bottom: spacing.lg,
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    pinWrap: { alignItems: "center" },
    pin: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.background,
    },
    pinSelected: { borderColor: colors.textPrimary, transform: [{ scale: 1.15 }] },
    pinText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    pinArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      marginTop: -1,
    },
  });
}
