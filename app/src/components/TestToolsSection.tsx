import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { useLocationOverride } from "../context/LocationOverrideContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme } from "../context/ThemeContext";
import { OptionDropdown } from "./OptionDropdown";
import { radii, spacing, ColorScheme } from "../theme";

// Rendered only when TEST_TOOLS is on (see lib/testTools) — i.e. in TestFlight
// test builds, never in the App Store build. Plain English on purpose: this is
// a tester-facing panel, not part of the product.

const TEST_CITIES = [
  { key: "lisboa", label: "Lisboa", lat: 38.7223, lng: -9.1393 },
  { key: "porto", label: "Porto", lat: 41.1579, lng: -8.6291 },
  { key: "faro", label: "Faro", lat: 37.0194, lng: -7.9322 },
  { key: "coimbra", label: "Coimbra", lat: 40.2033, lng: -8.4103 },
  { key: "braga", label: "Braga", lat: 41.5454, lng: -8.4265 },
  { key: "setubal", label: "Setúbal", lat: 38.5244, lng: -8.8882 },
  { key: "aveiro", label: "Aveiro", lat: 40.6443, lng: -8.6455 },
  { key: "evora", label: "Évora", lat: 38.5714, lng: -7.9135 },
  { key: "funchal", label: "Funchal (Madeira)", lat: 32.6669, lng: -16.9241 },
  { key: "pontaDelgada", label: "Ponta Delgada (Açores)", lat: 37.7412, lng: -25.6756 },
] as const;

const REAL_LOCATION = "real";

export function TestToolsSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { override, setOverride } = useLocationOverride();
  const { isSignedIn, hasPurchased, trialActive, trialDaysLeft, testSetTrialStart } = usePurchase();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const activeKey =
    TEST_CITIES.find((city) => override && city.lat === override.lat && city.lng === override.lng)?.key ??
    REAL_LOCATION;
  const locationOptions = [
    { label: "My real location", value: REAL_LOCATION as string },
    ...TEST_CITIES.map((city) => ({ label: city.label, value: city.key as string })),
  ];
  const changeLocation = (value: string) => {
    if (value === REAL_LOCATION) {
      setOverride(null);
      return;
    }
    const city = TEST_CITIES.find((c) => c.key === value);
    if (city) setOverride({ lat: city.lat, lng: city.lng });
  };

  const trialStatus = !isSignedIn
    ? "Signed out — sign in to start the 5-day trial."
    : hasPurchased
      ? "Pro is purchased on this device, so the trial no longer matters."
      : trialActive
        ? `Trial active — ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left.`
        : "Trial ended.";

  const moveTrial = async (startedDaysAgo: number, doneMessage: string) => {
    if (!testSetTrialStart) return;
    setBusy(true);
    try {
      await testSetTrialStart(startedDaysAgo);
      Alert.alert("Done", doneMessage);
    } catch (err) {
      Alert.alert("Couldn't change the trial", String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert("Up to date", "No newer update for this build.");
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      Alert.alert("Update check failed", String((err as Error)?.message ?? err));
    } finally {
      setChecking(false);
    }
  };

  const channel = Updates.channel || "none";
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : "embedded";

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Testing (test builds only)</Text>
      <View style={styles.body}>
        <View style={styles.row}>
          <Ionicons name="navigate-outline" size={19} style={styles.rowIcon} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Test location</Text>
            <Text style={styles.rowHint}>Pretend to be in a Portuguese city to see stations.</Text>
          </View>
        </View>
        <View style={styles.dropdownRow}>
          <OptionDropdown
            title="Test location"
            icon="navigate-outline"
            options={locationOptions}
            value={activeKey}
            onChange={changeLocation}
          />
        </View>

        <View style={[styles.row, styles.groupTop]}>
          <Ionicons name="hourglass-outline" size={19} style={styles.rowIcon} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Trial</Text>
            <Text style={styles.rowHint}>{trialStatus}</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.chip, (busy || !isSignedIn) && styles.chipDisabled]}
            disabled={busy || !isSignedIn}
            onPress={() =>
              moveTrial(6, "Trial ended. The Map tab reloads now with delayed prices.")
            }
          >
            <Text style={styles.chipText}>End trial now</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, (busy || !isSignedIn) && styles.chipDisabled]}
            disabled={busy || !isSignedIn}
            onPress={() =>
              moveTrial(0, "Trial restarted (5 days). The Map tab reloads now with live prices.")
            }
          >
            <Text style={styles.chipText}>Restart trial</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.row, styles.groupTop]} onPress={checkForUpdates} disabled={checking}>
          <Ionicons name="cloud-download-outline" size={19} style={styles.rowIcon} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{checking ? "Checking…" : "Check for updates"}</Text>
            <Text style={styles.rowHint}>
              Channel: {channel} · Update: {updateId}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    section: { marginBottom: spacing.md },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: spacing.xs + 2,
      marginLeft: spacing.xs,
    },
    body: {
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
    },
    groupTop: { borderTopWidth: 1, borderTopColor: colors.border },
    rowIcon: { color: colors.textSecondary, width: 24, marginRight: spacing.sm + 2 },
    rowInfo: { flex: 1 },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
    rowHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    dropdownRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    chip: {
      backgroundColor: colors.pillInactive,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipDisabled: { opacity: 0.4 },
    chipText: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  });
}
