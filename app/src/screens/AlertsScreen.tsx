import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useAlarms, Alarm } from "../context/AlarmsContext";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { SavingsSummaryCard } from "../components/SavingsSummaryCard";
import { FUEL_LABELS } from "../types/station";
import { radii, spacing, ColorScheme } from "../theme";
import { RootStackParamList, TabParamList } from "../navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Alerts">,
  NativeStackScreenProps<RootStackParamList>
>;

export function AlertsScreen({ navigation }: Props) {
  const { alarms, clearAlarm } = useAlarms();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const list = Object.values(alarms);

  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.stationId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<SavingsSummaryCard />}
        renderItem={({ item }: { item: Alarm }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("StationDetail", { stationId: item.stationId })}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="notifications" size={18} color={colors.accent} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {item.stationName}
              </Text>
              <Text style={styles.detail}>
                {t("alerts.rowText", {
                  fuel: FUEL_LABELS[item.fuelType],
                  price: item.targetPrice.toFixed(3),
                })}
              </Text>
            </View>
            <Pressable onPress={() => clearAlarm(item.stationId)} hitSlop={10} style={styles.removeButton}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("alerts.noneTitle")}</Text>
            <Text style={styles.emptyText}>{t("alerts.noneText")}</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
    listContent: { padding: spacing.lg, flexGrow: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    rowInfo: { flex: 1 },
    name: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    detail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    removeButton: { padding: 4 },
  });
}
