import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FuelType, Station } from "../types/station";
import { displayPrice, formatPrice } from "../utils/price";
import { TrendArrow } from "./TrendArrow";
import { FavoriteButton } from "./FavoriteButton";
import { useFavorites } from "../context/FavoritesContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { radii, spacing, ColorScheme } from "../theme";

function trendForFuelType(station: Station, fuelType: FuelType) {
  if (!station.trend || fuelType === "all") return null;
  return station.trend[fuelType] ?? null;
}

export function StationInfoPanel({
  station,
  fuelType,
  onClose,
  onOpenDetail,
}: {
  station: Station;
  fuelType: FuelType;
  onClose: () => void;
  onOpenDetail: () => void;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const price = displayPrice(station, fuelType);
  const cityLine = [station.postCode, station.place].filter(Boolean).join(" ");

  return (
    <View style={styles.panel}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <Pressable style={styles.content} onPress={onOpenDetail}>
        <View style={styles.headerRow}>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {station.brand || station.name}
            </Text>
            <Text style={styles.address} numberOfLines={2}>
              {station.street}
              {station.street && cityLine ? ", " : ""}
              {cityLine}
            </Text>
            {station.dist != null && (
              <View style={styles.statusRow}>
                <Text style={styles.dist}>{station.dist.toFixed(1)} km</Text>
              </View>
            )}
          </View>
          <View style={styles.right}>
            <Text style={styles.price}>{formatPrice(price)}</Text>
            <TrendArrow trend={trendForFuelType(station, fuelType)} />
          </View>
        </View>
        <View style={styles.footerRow}>
          <FavoriteButton active={isFavorite(station.id)} onPress={() => toggleFavorite(station)} />
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>{t("panel.viewDetails")}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    topBar: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 6, paddingRight: 6 },
    closeButton: { padding: 6 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    headerRow: { flexDirection: "row" },
    info: { flex: 1, paddingRight: spacing.sm },
    name: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
    address: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
    statusRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
    dist: { fontSize: 12, color: colors.textMuted },
    right: { alignItems: "flex-end", gap: 4 },
    price: { fontSize: 19, fontWeight: "800", color: colors.textPrimary },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    detailText: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  });
}
