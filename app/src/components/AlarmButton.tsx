import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Station } from "../types/station";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { useAlarms, AlarmFuelType } from "../context/AlarmsContext";
import { useStationFilters } from "../context/StationFiltersContext";
import { usePurchase } from "../context/PurchaseContext";

const FUEL_OPTIONS: { label: string; value: AlarmFuelType }[] = [
  { label: "E5", value: "e5" },
  { label: "E10", value: "e10" },
  { label: "Diesel", value: "diesel" },
];

export function AlarmButton({ station }: { station: Station }) {
  const { fuelType } = useStationFilters();
  const defaultFuelType: AlarmFuelType = fuelType === "all" ? "e5" : fuelType;
  const { getAlarm, setAlarm, clearAlarm } = useAlarms();
  const { hasPro, presentPaywall } = usePurchase();
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const existing = getAlarm(station.id);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(existing ? String(existing.targetPrice) : "");
  const [selectedFuel, setSelectedFuel] = useState<AlarmFuelType>(existing?.fuelType ?? defaultFuelType);

  const priceForFuel = (fuel: AlarmFuelType) =>
    fuel === "e5" ? station.e5 : fuel === "e10" ? station.e10 : station.diesel;

  const save = () => {
    const target = Number(input.replace(",", "."));
    if (!Number.isFinite(target) || target <= 0) return;
    const currentPrice = priceForFuel(selectedFuel);
    setAlarm(station.id, station.brand || station.name, selectedFuel, target, currentPrice ?? target);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          if (!hasPro) {
            presentPaywall("alerts");
            return;
          }
          setInput(existing ? String(existing.targetPrice) : "");
          setSelectedFuel(existing?.fuelType ?? defaultFuelType);
          setOpen(true);
        }}
        hitSlop={14}
        style={styles.trigger}
      >
        <Ionicons
          name={existing ? "notifications" : "notifications-outline"}
          size={26}
          color={existing ? colors.accent : colors.textMuted}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>
              {t("alerts.title", { fuel: selectedFuel.toUpperCase() })}
            </Text>
            <Text style={styles.hint}>
              {t("alerts.hint", { station: station.brand || station.name })}
            </Text>
            <View style={styles.fuelRow}>
              {FUEL_OPTIONS.map((option) => {
                const active = option.value === selectedFuel;
                const price = priceForFuel(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.fuelChip, active && styles.fuelChipActive]}
                    onPress={() => setSelectedFuel(option.value)}
                    disabled={price === null}
                  >
                    <Text
                      style={[
                        styles.fuelChipText,
                        active && styles.fuelChipTextActive,
                        price === null && styles.fuelChipTextDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={t("alerts.placeholder")}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <Pressable style={styles.saveButton} onPress={save}>
                <Text style={styles.saveButtonText}>
                  {existing ? t("alerts.update") : t("alerts.set")}
                </Text>
              </Pressable>
            </View>
            <View style={styles.footer}>
              {existing && (
                <Pressable
                  onPress={() => {
                    clearAlarm(station.id);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.clearText}>{t("alerts.remove")}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setOpen(false)} style={{ marginLeft: "auto" }}>
                <Text style={styles.closeText}>{t("common.close")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    trigger: { padding: 6 },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      padding: spacing.xl,
      paddingBottom: spacing.xl + 8,
    },
    title: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
    hint: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
    fuelRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    fuelChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fuelChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    fuelChipText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
    fuelChipTextActive: { color: colors.accentOn },
    fuelChipTextDisabled: { color: colors.textMuted },
    row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.textPrimary,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.lg,
      justifyContent: "center",
    },
    saveButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 14 },
    footer: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
    clearText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
    closeText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  });
}
