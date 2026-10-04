import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";
import { fetchStationDetail } from "../api/client";
import { FUEL_NAMES, FUEL_TYPES, Station, StationDetail, TrendInfo } from "../types/station";
import { formatPrice } from "../utils/price";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { TrendArrow } from "../components/TrendArrow";
import { FavoriteButton } from "../components/FavoriteButton";
import { PriceHistoryChart } from "../components/PriceHistoryChart";
import { AlarmButton } from "../components/AlarmButton";
import { DelayedPriceBanner } from "../components/DelayedPriceBanner";
import { openDirections } from "../utils/directions";
import { Ionicons } from "@expo/vector-icons";
import { useFavorites } from "../context/FavoritesContext";
import { useStationFilters } from "../context/StationFiltersContext";

type Props = NativeStackScreenProps<RootStackParamList, "StationDetail">;

export function StationDetailScreen({ route }: Props) {
  const { stationId, station: seed } = route.params;
  const [station, setStation] = useState<Station | StationDetail | null>(seed ?? null);
  const [pricesAsOf, setPricesAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { fuelType } = useStationFilters();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    let cancelled = false;
    fetchStationDetail(stationId)
      .then((data) => {
        if (!cancelled) {
          setStation(data.station);
          setPricesAsOf(data.pricesAsOf);
        }
      })
      .catch((err) => {
        // If we already have summary data from the list/map, keep showing it
        // rather than replacing it with an error for what's just an enrichment call.
        if (!cancelled && !seed) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, seed]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !station) {
    return (
      <View style={styles.center}>
        <Text>{error ?? t("detail.notFound")}</Text>
      </View>
    );
  }

  const cityLine = [station.postCode, station.place].filter(Boolean).join(" ");
  const availableFuels = FUEL_TYPES.filter((f) => station[f] != null);
  // Charting FUEL_TYPES[0] (gasoline_95) unconditionally would show "no data"
  // forever for a station that doesn't even sell it — fall back to whichever
  // fuel this station actually has.
  const chartFuelType = fuelType === "all" ? (availableFuels[0] ?? FUEL_TYPES[0]) : fuelType;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{station.brand || station.name}</Text>
          <Text style={styles.address}>
            {station.street}
            {station.street && cityLine ? ", " : ""}
            {cityLine}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <AlarmButton station={station} />
          <FavoriteButton
            active={isFavorite(station.id)}
            onPress={() => toggleFavorite(station)}
            size={28}
          />
        </View>
      </View>

      <Pressable
        style={styles.directionsButton}
        onPress={() => openDirections(station.lat, station.lng, station.brand || station.name)}
      >
        <Ionicons name="navigate" size={16} color={colors.accentOn} />
        <Text style={styles.directionsButtonText}>{t("detail.directions")}</Text>
      </Pressable>

      {pricesAsOf && <View style={styles.delayedBannerWrap}><DelayedPriceBanner pricesAsOf={pricesAsOf} /></View>}

      <View style={styles.priceCard}>
        {availableFuels.map((fuel, index) => (
          <React.Fragment key={fuel}>
            <PriceRow
              label={FUEL_NAMES[fuel]}
              value={station[fuel]}
              trend={station.trend?.[fuel]}
              styles={styles}
            />
            {index < availableFuels.length - 1 && <View style={styles.priceDivider} />}
          </React.Fragment>
        ))}
      </View>

      <PriceHistoryChart stationId={station.id} fuelType={chartFuelType} />
    </ScrollView>
  );
}

function PriceRow({
  label,
  value,
  trend,
  styles,
}: {
  label: string;
  value: number | null | undefined;
  trend: TrendInfo | null | undefined;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.priceValue}>{formatPrice(value)}</Text>
        <TrendArrow trend={trend} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    headerText: { flex: 1, paddingRight: spacing.sm },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    directionsButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    delayedBannerWrap: { marginTop: spacing.md },
    directionsButtonText: { color: colors.accentOn, fontSize: 14, fontWeight: "700" },
    name: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
    address: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
    priceCard: {
      marginTop: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
    },
    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 52,
      paddingVertical: spacing.sm,
    },
    priceDivider: { height: 1, backgroundColor: colors.border },
    priceLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
    priceValue: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  });
}
