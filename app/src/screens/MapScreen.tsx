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
import { usePurchase } from "../context/PurchaseContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { OptionDropdown } from "../components/OptionDropdown";
import { StationInfoPanel } from "../components/StationInfoPanel";
import { DelayedPriceBanner } from "../components/DelayedPriceBanner";
import { LocationFallbackBanner } from "../components/LocationFallbackBanner";
import { CheapestStationsModal } from "../components/CheapestStationsModal";
import { displayPrice, formatPrice } from "../utils/price";
import { buildPriceRanks } from "../utils/priceTier";
import { DARK_MAP_STYLE } from "../utils/mapStyle";
import { radii, spacing, ColorScheme } from "../theme";
import { RootStackParamList, TabParamList } from "../navigation/types";
import { FUEL_LABELS, FUEL_TYPES, Station } from "../types/station";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Map">,
  NativeStackScreenProps<RootStackParamList>
>;

export function MapScreen({ navigation }: Props) {
  const { coords, errorMsg, loading: locationLoading, fallback, retry: retryLocation } = useLocation();
  const { fuelType, setFuelType } = useStationFilters();
  const {
    stations,
    pricesAsOf,
    loading: stationsLoading,
    error: stationsError,
    refresh,
  } = useNearbyStations(coords, { type: fuelType, rad: MAX_RADIUS_KM });
  const [selected, setSelected] = useState<Station | null>(null);
  const [cheapestModalVisible, setCheapestModalVisible] = useState(false);
  const { checkAndNotify } = useAlarms();
  const { hasPro, presentPaywall } = usePurchase();
  const { colors, resolvedScheme } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tierColor = { cheap: colors.cheap, mid: colors.mid, expensive: colors.expensive };
  const mapRef = useRef<MapView>(null);
  const fuelTypeOptions: { label: string; value: typeof fuelType }[] = [
    { label: t("fuel.all"), value: "all" },
    ...FUEL_TYPES.map((fuel) => ({ label: FUEL_LABELS[fuel], value: fuel })),
  ];

  // MapView's initialRegion only positions the camera on first mount — if the
  // resolved location changes afterward (e.g. a slow real GPS fix arriving
  // after a cached one), the camera would otherwise silently stay put while
  // the data updates off-screen.
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

  // Free/expired-trial accounts already only ever see delayed data (server
  // enforced) — for them this is purely a paywall entry point. For Pro it
  // opens a real fuel-type picker + ranked list (see CheapestStationsModal) —
  // comparing raw prices across different fuel types isn't meaningful (GPL is
  // always far cheaper per litre than petrol/diesel regardless of which
  // station is the "best deal" for someone who actually needs petrol), so
  // this never silently picks a fuel on the user's behalf.
  const openCheapest = () => {
    if (!hasPro) {
      presentPaywall("compare");
      return;
    }
    setCheapestModalVisible(true);
  };

  const selectStationOnMap = (station: Station) => {
    setSelected(station);
    mapRef.current?.animateToRegion(
      { latitude: station.lat, longitude: station.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      500
    );
  };

  const tiers = useMemo(
    () => buildPriceRanks(stations.map((s) => displayPrice(s, fuelType))),
    [stations, fuelType]
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
        <View style={styles.filterRow}>
          <OptionDropdown
            title={t("filter.fuelType")}
            icon="water-outline"
            options={fuelTypeOptions}
            value={fuelType}
            onChange={setFuelType}
          />
          <View style={styles.iconButtonGroup}>
            <Pressable
              style={styles.cheapestIconButton}
              onPress={openCheapest}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("map.findCheapest")}
            >
              <Ionicons name="trophy" size={17} color={colors.cheap} />
            </Pressable>
            <Pressable
              style={styles.onMyWayIconButton}
              onPress={() => navigation.navigate("OnMyWay")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("map.onMyWay")}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>
        </View>
        {fallback && (
          <View style={styles.delayedBannerWrap}>
            <LocationFallbackBanner kind={fallback} />
          </View>
        )}
        {pricesAsOf && (
          <View style={styles.delayedBannerWrap}>
            <DelayedPriceBanner pricesAsOf={pricesAsOf} />
          </View>
        )}
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
          {stations.map((station, index) => {
            const tier = tiers.get(index) ?? "mid";
            const pinColor = tierColor[tier];
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

        {stationsLoading && stations.length === 0 && (
          <View style={styles.statusBanner} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.statusBannerText}>{t("map.loadingStations")}</Text>
          </View>
        )}

        {!stationsLoading && stationsError && stations.length === 0 && (
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

      <CheapestStationsModal
        visible={cheapestModalVisible}
        onClose={() => setCheapestModalVisible(false)}
        stations={stations}
        onSelectStation={selectStationOnMap}
      />
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
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
    },
    iconButtonGroup: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    onMyWayIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accentMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    cheapestIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cheapBg,
      alignItems: "center",
      justifyContent: "center",
    },
    delayedBannerWrap: { marginTop: spacing.sm, paddingHorizontal: spacing.lg },
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
