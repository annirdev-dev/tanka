import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FuelType } from "../types/station";
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
    { label: "E5", value: "e5" },
    { label: "E10", value: "e10" },
    { label: t("fuel.diesel"), value: "diesel" },
  ];

  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    track: {
      flexDirection: "row",
      backgroundColor: colors.pillInactive,
      borderRadius: radii.md,
      padding: 3,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
    },
    segmentActive: {
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
