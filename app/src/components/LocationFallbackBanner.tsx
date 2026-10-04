import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { LocationFallback } from "../hooks/useLocation";
import { radii, spacing, ColorScheme } from "../theme";

// Shown while the map is showing Lisbon instead of the real position, so a
// visitor outside Portugal (or someone with location off) understands why
// they see Portuguese stations — never an unexplained or empty screen.
export function LocationFallbackBanner({ kind }: { kind: LocationFallback }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <>
      <Ionicons name="location-outline" size={15} color={colors.accent} />
      <Text style={styles.text} numberOfLines={2}>
        {t(kind === "outside" ? "map.fallbackOutside" : "map.fallbackOff")}
      </Text>
      {kind === "off" && <Text style={styles.link}>{t("map.fallbackSettings")}</Text>}
    </>
  );

  if (kind === "off") {
    return (
      <Pressable style={styles.banner} onPress={() => Linking.openSettings()} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return <Pressable style={styles.banner} disabled>{content}</Pressable>;
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs + 2,
      backgroundColor: colors.accentMuted,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 3,
    },
    text: { flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: "600" },
    link: { fontSize: 12, color: colors.accent, fontWeight: "800" },
  });
}
