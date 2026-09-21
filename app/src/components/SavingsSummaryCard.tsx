import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlarms } from "../context/AlarmsContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { radii, spacing, ColorScheme } from "../theme";

// A rough, honest estimate — we only really know price-per-liter saved at
// the moment an alert triggered, not how much fuel anyone actually bought.
const ASSUMED_TANK_LITERS = 45;

export function SavingsSummaryCard() {
  const { savingsEvents } = useAlarms();
  const { hasPro, presentPaywall } = usePurchase();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totalPerLiter = savingsEvents.reduce((sum, e) => sum + e.savedPerLiter, 0);
  const estimatedTotal = totalPerLiter * ASSUMED_TANK_LITERS;
  const triggerCount = savingsEvents.length;

  if (!hasPro) {
    return (
      <Pressable style={styles.card} onPress={() => presentPaywall("savings")}>
        <View style={[styles.iconCircle, { backgroundColor: colors.pillInactive }]}>
          <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.info}>
          <Text style={styles.emptyTitle}>{t("savings.lockedTitle")}</Text>
          <Text style={styles.emptyText}>{t("savings.lockedText")}</Text>
        </View>
      </Pressable>
    );
  }

  if (triggerCount === 0) {
    return (
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: colors.pillInactive }]}>
          <Ionicons name="wallet-outline" size={22} color={colors.textMuted} />
        </View>
        <View style={styles.info}>
          <Text style={styles.emptyTitle}>{t("savings.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t("savings.emptyText")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: colors.cheapBg }]}>
        <Ionicons name="wallet-outline" size={22} color={colors.cheap} />
      </View>
      <View style={styles.info}>
        <Text style={styles.total}>
          {t("savings.total", { amount: estimatedTotal.toFixed(2) })}
        </Text>
        <Text style={styles.subtitle}>{t("savings.subtitle", { count: triggerCount })}</Text>
        <Text style={styles.caption}>{t("savings.caption", { liters: ASSUMED_TANK_LITERS })}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    total: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    caption: { fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 14 },
    emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    emptyText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  });
}
