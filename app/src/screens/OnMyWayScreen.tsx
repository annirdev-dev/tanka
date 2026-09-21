import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLocation } from "../hooks/useLocation";
import { useStationFilters } from "../context/StationFiltersContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { fetchNearbyStations, fetchRoute } from "../api/client";
import { displayPrice, formatPrice } from "../utils/price";
import { buildPriceRanks } from "../utils/priceTier";
import { cumulativeDistances, sampleAlongPolyline, closestOnPolyline, LatLng } from "../utils/geo";
import { DARK_MAP_STYLE } from "../utils/mapStyle";
import { Station } from "../types/station";
import { radii, spacing, ColorScheme } from "../theme";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OnMyWay">;

// The route is split into this many equal segments and we keep the single
// cheapest on-route station in each — so results are spread along the whole
// drive instead of piling up wherever stations are densest (i.e. cities).
const ROUTE_SEGMENTS = 8;
// How far off the road a station can sit and still count as "on the way".
const CORRIDOR_KM = 4;
// Ignore only the last stretch before the destination (you don't need a "stop
// on the way" once you've basically arrived) and the pump you're parked on.
// Capped at a quarter of the route each side so short trips still return
// something.
const START_SKIP_KM = 1.5;
const END_SKIP_KM = 8;
// One Tankerkoenig round trip per query point, and its API allows just one
// request per minute — so a long route is deliberately capped at a few
// spread-out query points rather than covering every kilometre.
const MAX_QUERY_POINTS = 5;
const KM_PER_QUERY_POINT = 60;

export function OnMyWayScreen({ navigation }: Props) {
  const { coords, loading: locationLoading } = useLocation();
  const { fuelType } = useStationFilters();
  const { hasPro, presentPaywall } = usePurchase();
  const { colors, resolvedScheme } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);

  const [toText, setToText] = useState("");
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [findingRoute, setFindingRoute] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [route, setRoute] = useState<{ from: string; to: string } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{
    origin: LatLng;
    dest: LatLng;
    polyline: LatLng[];
  } | null>(null);

  const canSearch = toText.trim().length > 0 && !searching && !!coords;

  // Turn the user's live coordinates into a readable place name for the fixed
  // "From" row — the trip always starts wherever they are now.
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng })
      .then((places) => {
        if (cancelled) return;
        const label = [places[0]?.city, places[0]?.country].filter(Boolean).join(", ");
        setOriginLabel(label || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng]);

  const geocodePlace = async (
    text: string
  ): Promise<{ point: LatLng; label: string } | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const geocoded = await Location.geocodeAsync(trimmed);
    if (geocoded.length === 0) return null;
    return { point: { lat: geocoded[0].latitude, lng: geocoded[0].longitude }, label: trimmed };
  };

  const search = async () => {
    if (!canSearch) return;
    if (!hasPro) {
      presentPaywall("onMyWay");
      return;
    }
    setSearching(true);
    setFindingRoute(true);
    setErrorMsg(null);
    setStations([]);
    setSearched(true);
    setProgress(null);
    setRoute(null);
    setRouteCoords(null);
    try {
      if (!coords) {
        setErrorMsg(t("map.locationUnavailable"));
        return;
      }
      const destResolved = await geocodePlace(toText);
      if (!destResolved) {
        setErrorMsg(t("onMyWay.notFound"));
        return;
      }

      const origin: LatLng = { lat: coords.lat, lng: coords.lng };
      const dest = destResolved.point;
      setRoute({ from: originLabel ?? t("onMyWay.yourLocation"), to: destResolved.label });

      // Real driving route (follows the actual roads) — everything below is
      // measured against this line, not a straight A-to-B guess.
      let polyline: LatLng[];
      try {
        polyline = (await fetchRoute(origin, dest)).polyline;
      } catch (err) {
        console.error("On my way: route lookup failed", err);
        setErrorMsg(t("onMyWay.routeFailed"));
        return;
      }
      if (polyline.length < 2) {
        setErrorMsg(t("onMyWay.routeFailed"));
        return;
      }
      setRouteCoords({ origin, dest, polyline });
      setFindingRoute(false);

      const cumDists = cumulativeDistances(polyline);
      const totalKm = cumDists[cumDists.length - 1];
      // Never skip more than a quarter of the route from either end.
      const startSkipKm = Math.min(START_SKIP_KM, totalKm * 0.25);
      const endSkipKm = Math.min(END_SKIP_KM, totalKm * 0.25);
      const usableFrom = startSkipKm;
      const usableTo = totalKm - endSkipKm;
      const usableSpan = Math.max(usableTo - usableFrom, 1);

      const queryCount = Math.min(
        Math.max(Math.round(totalKm / KM_PER_QUERY_POINT), 2),
        MAX_QUERY_POINTS
      );
      const waypoints = sampleAlongPolyline(polyline, cumDists, {
        count: queryCount,
        startOffsetKm: startSkipKm,
        endOffsetKm: endSkipKm,
      });

      // Keyed by station id; positionKm is how far along the drive it sits.
      const onRoute = new Map<string, { station: Station; positionKm: number }>();
      let failedWaypoints = 0;

      // Keep only the single cheapest station per route segment, so the
      // results spread evenly along the drive rather than clustering wherever
      // stations are densest.
      const pickSpread = () => {
        const bestPerSegment = new Map<number, { station: Station; positionKm: number }>();
        for (const entry of onRoute.values()) {
          const seg = Math.min(
            ROUTE_SEGMENTS - 1,
            Math.max(0, Math.floor(((entry.positionKm - usableFrom) / usableSpan) * ROUTE_SEGMENTS))
          );
          const current = bestPerSegment.get(seg);
          const price = displayPrice(entry.station, fuelType) ?? Infinity;
          const currentPrice = current
            ? displayPrice(current.station, fuelType) ?? Infinity
            : Infinity;
          if (!current || price < currentPrice) bestPerSegment.set(seg, entry);
        }
        return Array.from(bestPerSegment.values())
          .sort((a, b) => a.positionKm - b.positionKm)
          .map((x) => x.station);
      };

      for (let i = 0; i < waypoints.length; i++) {
        setProgress({ done: i, total: waypoints.length });
        try {
          const result = await fetchNearbyStations(waypoints[i].lat, waypoints[i].lng, {
            rad: 25,
            type: fuelType,
            sort: "dist",
          });
          for (const station of result) {
            if (onRoute.has(station.id)) continue;
            const { distanceKm: offRoute, positionKm } = closestOnPolyline(polyline, cumDists, {
              lat: station.lat,
              lng: station.lng,
            });
            if (offRoute <= CORRIDOR_KM && positionKm >= usableFrom && positionKm <= usableTo) {
              onRoute.set(station.id, { station, positionKm });
            }
          }
          setStations(pickSpread());
        } catch (err) {
          failedWaypoints += 1;
          console.error(`On my way: query point ${i + 1}/${waypoints.length} failed`, err);
        }
      }
      setProgress({ done: waypoints.length, total: waypoints.length });

      if (failedWaypoints === waypoints.length) {
        setErrorMsg(t("onMyWay.searchFailed"));
      }
    } catch (err) {
      console.error("On my way: search failed", err);
      setErrorMsg((err as Error).message || t("onMyWay.notFound"));
    } finally {
      setSearching(false);
      setFindingRoute(false);
    }
  };

  const tiers = useMemo(
    () => buildPriceRanks(stations.map((s) => displayPrice(s, fuelType))),
    [stations, fuelType]
  );
  const tierColors = { cheap: colors.cheap, mid: colors.mid, expensive: colors.expensive };

  useEffect(() => {
    if (!routeCoords || !mapRef.current) return;
    const points = routeCoords.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [routeCoords]);

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <View style={styles.fieldRow}>
          <View style={styles.fieldDotStart} />
          <Text
            style={[styles.fieldInput, styles.fieldStatic, !coords && styles.fieldStaticMuted]}
            numberOfLines={1}
          >
            {coords
              ? originLabel ?? t("onMyWay.yourLocation")
              : locationLoading
                ? t("onMyWay.locatingYou")
                : t("map.locationUnavailable")}
          </Text>
        </View>
        <View style={styles.fieldDivider} />
        <View style={styles.fieldRow}>
          <Ionicons name="flag" size={14} color={colors.accent} />
          <TextInput
            style={styles.fieldInput}
            value={toText}
            onChangeText={setToText}
            placeholder={t("onMyWay.toPlaceholder")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={search}
          />
        </View>
      </View>

      <Pressable
        style={[styles.searchButton, !canSearch && styles.searchButtonDisabled]}
        onPress={search}
        disabled={!canSearch}
      >
        {searching ? (
          <ActivityIndicator size="small" color={colors.accentOn} />
        ) : (
          <>
            <Ionicons name="search" size={16} color={colors.accentOn} />
            <Text style={styles.searchButtonText}>{t("onMyWay.search")}</Text>
          </>
        )}
      </Pressable>

      {route && (
        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={1}>
            {route.from}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
          <Text style={styles.routeText} numberOfLines={1}>
            {route.to}
          </Text>
        </View>
      )}

      <View style={[styles.mapArea, routeCoords ? styles.mapAreaFramed : styles.mapAreaPlain]}>
        {findingRoute ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : routeCoords ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            userInterfaceStyle={resolvedScheme}
            customMapStyle={Platform.OS === "android" && resolvedScheme === "dark" ? DARK_MAP_STYLE : []}
            initialRegion={{
              latitude: (routeCoords.origin.lat + routeCoords.dest.lat) / 2,
              longitude: (routeCoords.origin.lng + routeCoords.dest.lng) / 2,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
          >
            <Polyline
              coordinates={routeCoords.polyline.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor={colors.accent}
              strokeWidth={4}
            />
            <Marker
              coordinate={{ latitude: routeCoords.origin.lat, longitude: routeCoords.origin.lng }}
            >
              <View style={styles.originPin} />
            </Marker>
            <Marker
              coordinate={{ latitude: routeCoords.dest.lat, longitude: routeCoords.dest.lng }}
            >
              <View style={styles.destPin}>
                <Ionicons name="flag" size={13} color={colors.accentOn} />
              </View>
            </Marker>
            {stations.map((station, index) => {
              const tier = tiers.get(index) ?? "mid";
              const pinColor = station.isOpen ? tierColors[tier] : colors.closed;
              return (
                <Marker
                  key={station.id}
                  coordinate={{ latitude: station.lat, longitude: station.lng }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate("StationDetail", { stationId: station.id, station });
                  }}
                >
                  <View style={styles.stationPinWrap}>
                    <View style={[styles.stationPin, { backgroundColor: pinColor }]}>
                      <Text style={styles.stationPinText}>
                        {formatPrice(displayPrice(station, fuelType))}
                      </Text>
                    </View>
                    <View style={[styles.stationPinArrow, { borderTopColor: pinColor }]} />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Ionicons name="navigate-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {errorMsg
                ? t("onMyWay.routeFailed")
                : searched
                  ? t("onMyWay.emptyTitle")
                  : t("onMyWay.introTitle")}
            </Text>
            {!errorMsg && (
              <Text style={styles.emptyText}>
                {searched ? t("onMyWay.empty") : t("onMyWay.intro")}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.statusStrip}>
        {searching && progress ? (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={styles.progressText}>
              {t("onMyWay.progress", { done: progress.done, total: progress.total })}
            </Text>
          </View>
        ) : errorMsg && routeCoords ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : routeCoords && stations.length > 0 ? (
          <Text style={styles.hint}>{t("onMyWay.hint")}</Text>
        ) : routeCoords && searched ? (
          <Text style={styles.hint}>{t("onMyWay.empty")}</Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    form: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
    fieldDotStart: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginLeft: 3 },
    fieldDivider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 11 },
    fieldInput: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      fontSize: 15,
      color: colors.textPrimary,
    },
    fieldStatic: { fontWeight: "600" },
    fieldStaticMuted: { color: colors.textMuted, fontWeight: "400" },
    searchButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 2,
    },
    searchButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 14 },
    searchButtonDisabled: { opacity: 0.5 },
    routeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    routeText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600", flexShrink: 1 },
    mapArea: {
      flex: 1,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    mapAreaFramed: { borderWidth: 1, borderColor: colors.border },
    mapAreaPlain: {},
    map: { flex: 1 },
    originPin: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.background,
    },
    destPin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    stationPinWrap: { alignItems: "center" },
    stationPin: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.background,
    },
    stationPinText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    stationPinArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      marginTop: -1,
    },
    statusStrip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 34 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    progressText: { fontSize: 13, color: colors.textSecondary },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    errorText: { fontSize: 13, color: colors.danger },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
  });
}
