import React, { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { usePurchase } from "../context/PurchaseContext";
import { TranslationKey } from "../i18n/translations";
import { AccountSection } from "../components/AccountSection";
import { radii, spacing, ColorScheme } from "../theme";

const CHIPS: { key: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "onboarding.chip.favorites", icon: "heart-outline" },
  { key: "onboarding.chip.alerts", icon: "notifications-outline" },
  { key: "onboarding.chip.savings", icon: "wallet-outline" },
];

// Opens the public legal page rather than the in-app Privacy/Terms screens —
// this runs before onboarding completes, so there's no NavigationContainer
// mounted yet to navigate within.
const PRIVACY_URL = "https://annirdev-dev.github.io/tanken-legal/#datenschutz";
const TERMS_URL = "https://annirdev-dev.github.io/tanken-legal/#nutzungsbedingungen";

// Shown once, before anything else, until the user signs in or buys Pro
// outright — required so every user has an account (or a purchase) from the
// start, and so the Pro trial, which only ever runs for signed-in accounts,
// starts right away. Fills the full screen (hero up top, actions anchored to
// the bottom) rather than floating as a small centered card. The chip row
// reuses the exact icons Favorites/Alerts/Savings use elsewhere in the app,
// so it reads as a preview of real features rather than another feature list.
export function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { priceLabel, purchasePro, restorePurchases } = usePurchase();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <View style={styles.heroBackdrop}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="gas-station" size={34} color={colors.accentOn} />
          </View>
        </View>
        <Text style={styles.title}>{t("onboarding.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.trialCta")}</Text>

        <View style={styles.chipRow}>
          {CHIPS.map((chip) => (
            <View key={chip.key} style={styles.chip}>
              <Ionicons name={chip.icon} size={17} color={colors.accent} />
              <Text style={styles.chipText}>{t(chip.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <AccountSection showHint={false} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("pro.or")}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.buyButton} onPress={purchasePro}>
          <Text style={styles.buyButtonText}>
            {priceLabel ? t("pro.unlockFor", { price: priceLabel }) : t("pro.unlock")}
          </Text>
        </Pressable>
        <Pressable onPress={restorePurchases} hitSlop={8}>
          <Text style={styles.restoreText}>{t("pro.restore")}</Text>
        </Pressable>

        <Text style={styles.legalText}>
          {t("onboarding.legalPrefix")}{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
            {t("legal.privacyPolicy")}
          </Text>{" "}
          {t("onboarding.legalAnd")}{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>
            {t("legal.terms")}
          </Text>
          .
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
    top: { alignItems: "center" },
    heroBackdrop: {
      width: 132,
      height: 132,
      borderRadius: 66,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    heroIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
      paddingHorizontal: spacing.md,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 21,
      paddingHorizontal: spacing.lg,
    },
    chipRow: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 3,
    },
    chipText: { fontSize: 12.5, fontWeight: "700", color: colors.textPrimary },
    actions: { width: "100%" },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      alignSelf: "stretch",
      marginVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    buyButton: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
    },
    buyButtonText: { color: colors.accent, fontWeight: "700", fontSize: 14.5 },
    restoreText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.md,
      textAlign: "center",
    },
    legalText: {
      fontSize: 11.5,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 16,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    legalLink: {
      color: colors.textSecondary,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
  });
}
