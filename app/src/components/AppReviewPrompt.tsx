import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { radii, spacing, ColorScheme } from "../theme";
import { requestAppReview } from "../lib/appReview";

const FEEDBACK_EMAIL = "annirdev@gmail.com";

const KEY_FIRST_OPEN = "review:first-open-at";
const KEY_OPEN_COUNT = "review:open-count";
const KEY_ASKED_AT = "review:asked-at";
const KEY_COMPLETED = "review:completed";
const KEY_DECLINED = "review:declined-count";

// The prompt only appears once the user has genuinely used the app: at least
// this many cold starts, spread over at least this many days.
const MIN_OPENS = 5;
const MIN_DAYS = 3;
// After any ask (yes, no, or dismissed) don't ask again for this long.
const REASK_COOLDOWN_MS = 75 * 24 * 60 * 60_000;
// After this many "not really" answers, never auto-ask again.
const MAX_DECLINES = 2;
// Let the app settle before interrupting.
const SHOW_DELAY_MS = 2500;

// Mounted once near the app root. On each cold start it counts the launch and,
// if the usage bar is cleared and we're outside the cooldown, shows a single
// "Enjoying Tanken?" sheet — routing happy users to the store rating prompt
// and unhappy ones to a private feedback email.
export function AppReviewPrompt() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const now = Date.now();
        const firstRaw = await AsyncStorage.getItem(KEY_FIRST_OPEN);
        const firstOpenAt = firstRaw ? Number(firstRaw) : now;
        if (!firstRaw) await AsyncStorage.setItem(KEY_FIRST_OPEN, String(firstOpenAt));

        const openCount = Number((await AsyncStorage.getItem(KEY_OPEN_COUNT)) ?? "0") + 1;
        await AsyncStorage.setItem(KEY_OPEN_COUNT, String(openCount));

        if ((await AsyncStorage.getItem(KEY_COMPLETED)) === "true") return;
        if (Number((await AsyncStorage.getItem(KEY_DECLINED)) ?? "0") >= MAX_DECLINES) return;

        const askedAt = Number((await AsyncStorage.getItem(KEY_ASKED_AT)) ?? "0");
        if (askedAt && now - askedAt < REASK_COOLDOWN_MS) return;

        if (openCount < MIN_OPENS) return;
        if (now - firstOpenAt < MIN_DAYS * 24 * 60 * 60_000) return;

        setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      } catch {
        // A rating nudge must never get in the way of the app working.
      }
    })();
  }, []);

  const close = () => setVisible(false);

  const handleYes = async () => {
    close();
    await AsyncStorage.multiSet([
      [KEY_ASKED_AT, String(Date.now())],
      [KEY_COMPLETED, "true"],
    ]).catch(() => undefined);
    await requestAppReview();
  };

  const handleNo = async () => {
    close();
    const prev = Number((await AsyncStorage.getItem(KEY_DECLINED).catch(() => "0")) ?? "0");
    await AsyncStorage.multiSet([
      [KEY_ASKED_AT, String(Date.now())],
      [KEY_DECLINED, String(prev + 1)],
    ]).catch(() => undefined);
    Linking.openURL(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t("review.emailSubject"))}`
    ).catch(() => undefined);
  };

  const handleLater = async () => {
    close();
    await AsyncStorage.setItem(KEY_ASKED_AT, String(Date.now())).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleLater}>
      <Pressable style={styles.backdrop} onPress={handleLater}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("review.title")}</Text>
          <Text style={styles.subtitle}>{t("review.subtitle")}</Text>

          <Pressable style={styles.primaryButton} onPress={handleYes}>
            <Text style={styles.primaryButtonText}>{t("review.yes")}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleNo}>
            <Text style={styles.secondaryButtonText}>{t("review.no")}</Text>
          </Pressable>
          <Pressable onPress={handleLater} hitSlop={8} style={styles.laterButton}>
            <Text style={styles.laterText}>{t("review.later")}</Text>
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
    title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    primaryButton: {
      width: "100%",
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 3,
      alignItems: "center",
      marginTop: spacing.lg,
    },
    primaryButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 15 },
    secondaryButton: {
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 3,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    secondaryButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
    laterButton: { marginTop: spacing.md },
    laterText: { fontSize: 12, color: colors.textMuted },
  });
}
