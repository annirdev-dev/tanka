import React, { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { usePurchase } from "../context/PurchaseContext";
import { radii, spacing, ColorScheme } from "../theme";

// Shown only when the backend actually served delayed data (pricesAsOf is
// null for Pro/trial accounts) — a plain-language disclosure that what's on
// screen isn't live, with a direct path to the reason why.
export function DelayedPriceBanner({ pricesAsOf }: { pricesAsOf: string | null }) {
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const { presentPaywall, hasPurchased, isSignedIn } = usePurchase();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!pricesAsOf) return null;

  const label = new Date(pricesAsOf).toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // This iPhone's Apple ID owns Pro but nobody is signed in: live prices are
  // tied to the account, so say that instead of calling it the free plan.
  if (hasPurchased && !isSignedIn) {
    return (
      <Pressable
        style={styles.banner}
        onPress={() => Alert.alert(t("pro.signInToActivateTitle"), t("pro.signInToActivateMsg"))}
      >
        <Ionicons name="time-outline" size={14} color={colors.mid} />
        <Text style={styles.text} numberOfLines={1}>
          {t("delayedPrices.signedOutPro")}
        </Text>
        <Text style={styles.link}>{t("delayedPrices.signedOutProLink")}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.banner} onPress={() => presentPaywall("compare")}>
      <Ionicons name="time-outline" size={14} color={colors.mid} />
      <Text style={styles.text} numberOfLines={1}>
        {t("delayedPrices.banner", { date: label })}
      </Text>
      <Text style={styles.link}>{t("delayedPrices.unlock")}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs + 2,
      backgroundColor: colors.midBg,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 3,
    },
    text: { flex: 1, fontSize: 11.5, color: colors.mid, fontWeight: "600" },
    link: { fontSize: 11.5, color: colors.accent, fontWeight: "800" },
  });
}
