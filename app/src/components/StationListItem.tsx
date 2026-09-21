import React, { useMemo } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FuelType, Station } from "../types/station";
import { displayPrice, formatPrice } from "../utils/price";
import { PriceTier } from "../utils/priceTier";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { TrendArrow } from "./TrendArrow";
import { FavoriteButton } from "./FavoriteButton";
import { useFavorites } from "../context/FavoritesContext";

function trendForFuelType(station: Station, fuelType: FuelType) {
  if (!station.trend) return null;
  if (fuelType === "e5") return station.trend.e5 ?? null;
  if (fuelType === "e10") return station.trend.e10 ?? null;
  if (fuelType === "diesel") return station.trend.diesel ?? null;
  return null;
}

export function StationListItem({
  station,
  fuelType,
  tier,
  onPress,
  compact = false,
}: {
  station: Station;
  fuelType: FuelType;
  tier: PriceTier;
  onPress: () => void;
  compact?: boolean;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tierColor = { cheap: colors.cheap, mid: colors.mid, expensive: colors.expensive }[tier];
  const price = displayPrice(station, fuelType);

  const handleShare = () => {
    const fuelLabel =
      fuelType === "e5"
        ? "E5"
        : fuelType === "e10"
          ? "E10"
          : fuelType === "diesel"
            ? t("fuel.diesel")
            : t("share.cheapest");
    Share.share({
      message: t("share.message", {
        name: station.brand || station.name,
        fuel: fuelLabel,
        price: formatPrice(price),
        place: station.place,
      }),
    }).catch(() => undefined);
  };

  return (
    <Pressable style={[styles.row, compact && styles.rowCompact]} onPress={onPress}>
      <View style={[styles.tierBar, { backgroundColor: tierColor }]} />
      <View style={[styles.info, compact && styles.infoCompact]}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
          {station.brand || station.name}
        </Text>
        {!compact && (
          <Text style={styles.address} numberOfLines={1}>
            {station.street}, {station.place}
          </Text>
        )}
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: station.isOpen ? colors.cheap : colors.closed }]} />
          <Text style={styles.statusText}>
            {station.isOpen ? t("status.open") : t("status.closed")}
          </Text>
          {station.dist != null && (
            <Text style={styles.dist}>· {station.dist.toFixed(1)} km</Text>
          )}
        </View>
      </View>
      <View style={[styles.right, compact && styles.rightCompact]}>
        {!compact && (
          <View style={styles.iconRow}>
            <Pressable onPress={handleShare} hitSlop={14} style={styles.shareButton}>
              <Ionicons name="share-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <FavoriteButton active={isFavorite(station.id)} onPress={() => toggleFavorite(station)} />
          </View>
        )}
        <Text style={[styles.price, compact && styles.priceCompact, { color: tierColor }]}>
          {formatPrice(price)}
        </Text>
        {!compact && <TrendArrow trend={trendForFuelType(station, fuelType)} />}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: colors.background,
      borderRadius: radii.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowCompact: { marginBottom: spacing.xs },
    tierBar: { width: 4 },
    info: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.sm },
    infoCompact: { paddingVertical: spacing.sm },
    name: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    nameCompact: { fontSize: 14 },
    address: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    statusRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
    dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusText: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
    dist: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
    right: { alignItems: "flex-end", justifyContent: "center", paddingVertical: spacing.sm, paddingRight: spacing.md, paddingLeft: spacing.xs, gap: 2 },
    iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    shareButton: { padding: 6 },
    rightCompact: { paddingVertical: spacing.xs },
    price: { fontSize: 17, fontWeight: "800" },
    priceCompact: { fontSize: 15 },
  });
}
