import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePurchase } from "../context/PurchaseContext";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { PRO_FEATURES } from "../lib/proFeatures";
import { radii, spacing, ColorScheme } from "../theme";

export function ProPaywallModal() {
  const {
    paywallVisible,
    paywallFeature,
    dismissPaywall,
    purchasePro,
    restorePurchases,
    priceLabel,
    isSignedIn,
    trialDaysLeft,
  } = usePurchase();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={paywallVisible} transparent animationType="fade" onRequestClose={dismissPaywall}>
      <Pressable style={styles.backdrop} onPress={dismissPaywall}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <Ionicons name="star" size={22} color={colors.accentOn} />
          </View>
          <Text style={styles.title}>
            {paywallFeature === "trialEnded" ? t("pro.trialEndedTitle") : t("pro.title")}
          </Text>
          <Text style={styles.subtitle}>
            {(() => {
              if (paywallFeature === "trialEnded") return t("pro.pitchTrialEnded");
              const matched = PRO_FEATURES.find((f) => f.key === paywallFeature);
              return t(matched?.pitchKey ?? "pro.pitchGeneric");
            })()}
          </Text>

          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature.key} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.cheap} />
                <Text style={styles.featureText}>{t(feature.featureKey)}</Text>
              </View>
            ))}
          </View>

          {!isSignedIn && (
            <Text style={styles.signInHint}>{t("pro.signInHint", { days: trialDaysLeft })}</Text>
          )}

          <Pressable style={styles.buyButton} onPress={purchasePro}>
            <Text style={styles.buyButtonText}>
              {priceLabel ? t("pro.unlockFor", { price: priceLabel }) : t("pro.unlock")}
            </Text>
          </Pressable>
          <Pressable onPress={restorePurchases} hitSlop={8}>
            <Text style={styles.restoreText}>{t("pro.restore")}</Text>
          </Pressable>
          <Pressable onPress={dismissPaywall} hitSlop={8} style={styles.closeButton}>
            <Text style={styles.closeText}>{t("pro.maybeLater")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      padding: spacing.xl,
      alignItems: "center",
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    featureList: { width: "100%", marginTop: spacing.lg, gap: spacing.sm },
    featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    featureText: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
    signInHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 16,
    },
    buyButton: {
      width: "100%",
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
      marginTop: spacing.lg,
    },
    buyButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 15 },
    restoreText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
      marginTop: spacing.md,
    },
    closeButton: { marginTop: spacing.sm },
    closeText: { fontSize: 12, color: colors.textMuted },
  });
}
