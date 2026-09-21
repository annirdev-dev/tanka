import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";

export function OpenNowToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.pill, value && styles.pillActive]}
      onPress={() => onChange(!value)}
    >
      <Ionicons
        name="time-outline"
        size={14}
        color={value ? colors.accentOn : colors.textSecondary}
      />
      <Text style={[styles.label, value && styles.labelActive]}>{t("filter.openNow")}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.pillInactive,
      borderWidth: 1,
      borderColor: colors.pillInactive,
    },
    pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    label: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    labelActive: { color: colors.accentOn },
  });
}
