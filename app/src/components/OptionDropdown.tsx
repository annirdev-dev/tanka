import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

export function OptionDropdown<T extends string>({
  title,
  icon,
  options,
  value,
  onChange,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeLabel = options.find((option) => option.value === value)?.label ?? "";

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        {icon && <Ionicons name={icon} size={14} color={colors.textSecondary} />}
        <Text style={styles.triggerText}>{activeLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{title}</Text>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    trigger: {
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
    triggerText: { fontSize: 12, color: colors.textPrimary, fontWeight: "700" },
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.xl },
    menu: {
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    menuTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionText: { fontSize: 16, color: colors.textPrimary },
    optionTextActive: { fontWeight: "700", color: colors.accent },
  });
}
