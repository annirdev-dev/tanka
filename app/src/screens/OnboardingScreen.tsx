import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { usePurchase } from "../context/PurchaseContext";
import { TranslationKey } from "../i18n/translations";
import { AccountSection } from "../components/AccountSection";
import { LegalScreen } from "../components/LegalScreen";
import { privacyPolicy, terms } from "../legal/content";
import { radii, spacing, ColorScheme } from "../theme";

const CHIPS: { key: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "onboarding.chip.favorites", icon: "heart-outline" },
  { key: "onboarding.chip.alerts", icon: "notifications-outline" },
  { key: "onboarding.chip.savings", icon: "wallet-outline" },
];

// Shown once, before anything else, until the user signs in or buys Pro
// outright — required so every user has an account (or a purchase) from the
// start, and so the Pro trial, which only ever runs for signed-in accounts,
// starts right away. Fills the full screen (hero up top, actions anchored to
// the bottom) rather than floating as a small centered card. The chip row
// reuses the exact icons Favorites/Alerts/Savings use elsewhere in the app,
// so it reads as a preview of real features rather than another feature list.
export function OnboardingScreen() {
  const { colors } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const { trialDaysLeft, restorePurchases } = usePurchase();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <View style={styles.screen}>
      <Pressable
        style={[styles.languageToggle, { top: insets.top + spacing.sm }]}
        onPress={() => setLocale(locale === "pt" ? "en" : "pt")}
        hitSlop={8}
      >
        <Ionicons name="language-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.languageToggleText}>{locale === "pt" ? "English" : "Português"}</Text>
      </Pressable>

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
        <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>

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

        <Text style={styles.trialNote}>{t("onboarding.trialNote", { days: trialDaysLeft })}</Text>

        <Text style={styles.legalText}>
          {t("onboarding.legalPrefix")}{" "}
          <Text style={styles.legalLink} onPress={() => setLegalModal("privacy")}>
            {t("legal.privacyPolicy")}
          </Text>{" "}
          {t("onboarding.legalAnd")}{" "}
          <Text style={styles.legalLink} onPress={() => setLegalModal("terms")}>
            {t("legal.terms")}
          </Text>
          .
        </Text>

        <Pressable onPress={restorePurchases} hitSlop={8}>
          <Text style={styles.restoreText}>{t("pro.restore")}</Text>
        </Pressable>
      </View>

      <Modal
        visible={legalModal != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalModal(null)}
      >
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setLegalModal(null)} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <LegalScreen doc={legalModal === "privacy" ? privacyPolicy : terms} />
      </Modal>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
    languageToggle: {
      position: "absolute",
      right: spacing.lg,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    languageToggleText: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
    top: { alignItems: "center" },
    heroBackdrop: {
      width: 132,
      height: 132,
      borderRadius: 66,
      backgroundColor: colors.accentMuted,
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
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 4,
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
      backgroundColor: colors.accentMuted,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 3,
    },
    chipText: { fontSize: 12.5, fontWeight: "700", color: colors.textPrimary },
    actions: { width: "100%" },
    trialNote: {
      fontSize: 12.5,
      color: colors.textMuted,
      fontWeight: "600",
      textAlign: "center",
      marginTop: spacing.md,
    },
    restoreText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.lg,
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
    modalHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
      padding: spacing.lg,
    },
  });
}
