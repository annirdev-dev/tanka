import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { formatPrice } from "../utils/price";
import { radii, spacing, ColorScheme } from "../theme";
import { ConcreteFuelType, FUEL_LABELS, FUEL_TYPES, Station } from "../types/station";

const MAX_RESULTS = 5;

export function CheapestStationsModal({
  visible,
  onClose,
  stations,
  onSelectStation,
}: {
  visible: boolean;
  onClose: () => void;
  stations: Station[];
  onSelectStation: (station: Station) => void;
}) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fuel, setFuel] = useState<ConcreteFuelType | null>(null);

  const results = useMemo(() => {
    if (!fuel) return [];
    return stations
      .filter((s) => s[fuel] != null)
      .sort((a, b) => (a[fuel] as number) - (b[fuel] as number))
      .slice(0, MAX_RESULTS);
  }, [stations, fuel]);

  const handleClose = () => {
    setFuel(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            {fuel && (
              <Pressable onPress={() => setFuel(null)} hitSlop={8} style={styles.backButton}>
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            <Text style={styles.title}>
              {fuel ? t("map.cheapestResultsTitle", { fuel: FUEL_LABELS[fuel] }) : t("map.cheapestPickFuel")}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {!fuel ? (
            <View style={styles.fuelGrid}>
              {FUEL_TYPES.map((f) => (
                <Pressable key={f} style={styles.fuelChip} onPress={() => setFuel(f)}>
                  <Text style={styles.fuelChipText}>{FUEL_LABELS[f]}</Text>
                </Pressable>
              ))}
            </View>
          ) : results.length === 0 ? (
            <Text style={styles.emptyText}>{t("map.cheapestEmpty")}</Text>
          ) : (
            <ScrollView style={styles.resultsList}>
              {results.map((station, index) => (
                <Pressable
                  key={station.id}
                  style={[styles.resultRow, index === results.length - 1 && styles.resultRowLast]}
                  onPress={() => {
                    onSelectStation(station);
                    handleClose();
                  }}
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {station.brand || station.name}
                    </Text>
                    {station.dist != null && (
                      <Text style={styles.resultDist}>{station.dist.toFixed(1)} km</Text>
                    )}
                  </View>
                  <Text style={styles.resultPrice}>{formatPrice(station[fuel])}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.xl },
    sheet: {
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      padding: spacing.lg,
      maxHeight: "70%",
    },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    backButton: { padding: 2 },
    title: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.textPrimary },
    fuelGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    fuelChip: {
      backgroundColor: colors.pillInactive,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    fuelChipText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
    resultsList: { maxHeight: 320 },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultRowLast: { borderBottomWidth: 0 },
    rankBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.cheapBg,
      alignItems: "center",
      justifyContent: "center",
    },
    rankText: { fontSize: 11, fontWeight: "800", color: colors.cheap },
    resultInfo: { flex: 1, minWidth: 0 },
    resultName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    resultDist: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    resultPrice: { fontSize: 15, fontWeight: "800", color: colors.cheap },
  });
}
