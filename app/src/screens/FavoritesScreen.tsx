import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFavorites } from "../context/FavoritesContext";
import { useStationFilters } from "../context/StationFiltersContext";
import { useAlarms } from "../context/AlarmsContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { StationListItem } from "../components/StationListItem";
import { fetchStationPrices } from "../api/client";
import { displayPrice } from "../utils/price";
import { buildPriceRanks } from "../utils/priceTier";
import { FUEL_TYPES } from "../types/station";
import { spacing, ColorScheme } from "../theme";
import { RootStackParamList, TabParamList } from "../navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Favorites">,
  NativeStackScreenProps<RootStackParamList>
>;

export function FavoritesScreen({ navigation }: Props) {
  const { favorites, updateFavoritePrices } = useFavorites();
  const { fuelType } = useStationFilters();
  const { checkAndNotify } = useAlarms();
  const { entitlementVersion } = usePurchase();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);

  const stations = useMemo(
    () => Object.values(favorites).sort((a, b) => {
      const pa = displayPrice(a, fuelType);
      const pb = displayPrice(b, fuelType);
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    }),
    [favorites, fuelType]
  );

  const tiers = useMemo(
    () => buildPriceRanks(stations.map((s) => displayPrice(s, fuelType))),
    [stations, fuelType]
  );

  const refresh = async () => {
    const ids = Object.keys(favorites);
    if (ids.length === 0) return;
    setRefreshing(true);
    try {
      const { prices, trends } = await fetchStationPrices(ids);
      const updates: Record<string, Partial<typeof favorites[string]>> = {};
      for (const id of ids) {
        const entry = prices[id];
        if (!entry) continue;
        const patch: Partial<typeof favorites[string]> = { trend: trends[id] };
        for (const fuel of FUEL_TYPES) patch[fuel] = entry[fuel];
        updates[id] = patch;
      }
      updateFavoritePrices(updates);
      checkAndNotify(
        Object.entries(updates).map(([id, patch]) => ({ ...favorites[id], ...patch }))
      );
    } catch {
      // Keep last-known prices if the refresh fails — not worth surfacing an
      // error for a background convenience refresh of already-visible data.
    } finally {
      setRefreshing(false);
    }
  };

  // Favorites keep their last-fetched prices, which are delayed or live per
  // the account — reload them when that entitlement changes (Pro purchase
  // recorded, trial ended or restarted), not just on pull-to-refresh.
  useEffect(() => {
    if (entitlementVersion > 0) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementVersion]);

  return (
    <View style={styles.container}>
      <FlatList
        data={stations}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <StationListItem
            station={item}
            fuelType={fuelType}
            tier={tiers.get(index) ?? "mid"}
            onPress={() =>
              navigation.navigate("StationDetail", { stationId: item.id, station: item })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="heart-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("favorites.noneTitle")}</Text>
            <Text style={styles.emptyText}>{t("favorites.none")}</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.sm },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
    listContent: { paddingTop: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  });
}
