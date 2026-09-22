import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { FUEL_LABELS, FUEL_TYPES, FuelType } from "../types/station";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";

export function FuelTypeFilter({
  value,
  onChange,
}: {
  value: FuelType;
  onChange: (type: FuelType) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const options: { label: string; value: FuelType }[] = [
    { label: t("fuel.all"), value: "all" },
    ...FUEL_TYPES.map((fuel) => ({ label: FUEL_LABELS[fuel], value: fuel })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    track: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    chip: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.pillInactive,
    },
    chipActive: {
      backgroundColor: colors.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    label: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
    labelActive: { color: colors.textPrimary, fontWeight: "700" },
  });
}
