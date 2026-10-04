import React, { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Notifications from "../lib/notifications";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFavorites } from "../context/FavoritesContext";
import { useAlarms } from "../context/AlarmsContext";
import { useStationFilters } from "../context/StationFiltersContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme, ThemeMode } from "../context/ThemeContext";
import { useLocale, Locale } from "../context/LocaleContext";
import { OptionDropdown } from "../components/OptionDropdown";
import { AccountSection } from "../components/AccountSection";
import { TestToolsSection } from "../components/TestToolsSection";
import { TEST_TOOLS } from "../lib/testTools";
import { requestAppReview, shareApp } from "../lib/appReview";
import { PRO_FEATURES } from "../lib/proFeatures";
import { radii, spacing, ColorScheme } from "../theme";
import { RootStackParamList, TabParamList } from "../navigation/types";
import { FUEL_LABELS, FUEL_TYPES } from "../types/station";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Settings">,
  NativeStackScreenProps<RootStackParamList>
>;

export function SettingsScreen({ navigation }: Props) {
  const { favorites, clearAllFavorites } = useFavorites();
  const { alarms, clearAllAlarms, savingsEvents, clearSavings } = useAlarms();
  const { fuelType, setFuelType } = useStationFilters();
  const { mode, setMode, colors } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const {
    hasPro,
    hasPurchased,
    isSignedIn,
    trialActive,
    trialDaysLeft,
    priceLabel,
    purchasePro,
    restorePurchases,
  } = usePurchase();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [proExpanded, setProExpanded] = useState(false);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync().then((result) => setNotificationsEnabled(result.granted));
      Location.getForegroundPermissionsAsync().then((result) => setLocationStatus(result.status));
    }, [])
  );

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const result = await Notifications.requestPermissionsAsync();
      if (result.granted) {
        setNotificationsEnabled(true);
      } else {
        Alert.alert(t("settings.notificationsDisabledTitle"), t("settings.notificationsDisabledMsg"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("settings.openSettings"), onPress: () => Linking.openSettings() },
        ]);
      }
    } else {
      Alert.alert(t("settings.turnOffNotificationsTitle"), t("settings.turnOffNotificationsMsg"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("settings.openSettings"), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const fixLocationPermission = async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    setLocationStatus(result.status);
    if (!result.granted) {
      Alert.alert(t("settings.locationDisabledTitle"), t("settings.locationDisabledMsg"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("settings.openSettings"), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const confirmClearFavorites = () => {
    Alert.alert(t("settings.removeFavoritesTitle"), t("settings.cantUndo"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.removeAll"), style: "destructive", onPress: clearAllFavorites },
    ]);
  };

  const confirmClearAlarms = () => {
    Alert.alert(t("settings.removeAlertsTitle"), t("settings.cantUndo"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.removeAll"), style: "destructive", onPress: clearAllAlarms },
    ]);
  };

  const confirmClearSavings = () => {
    Alert.alert(t("settings.removeSavingsTitle"), t("settings.cantUndo"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.removeAll"), style: "destructive", onPress: clearSavings },
    ]);
  };

  const favoriteCount = Object.keys(favorites).length;
  const alarmCount = Object.keys(alarms).length;
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const locationGranted = locationStatus === Location.PermissionStatus.GRANTED;

  const themeOptions: { label: string; value: ThemeMode }[] = [
    { label: t("settings.themeLight"), value: "light" },
    { label: t("settings.themeDark"), value: "dark" },
  ];
  const localeOptions: { label: string; value: Locale }[] = [
    { label: "Português", value: "pt" },
    { label: "English", value: "en" },
  ];
  const fuelTypeOptions: { label: string; value: typeof fuelType }[] = [
    { label: t("fuel.all"), value: "all" },
    ...FUEL_TYPES.map((fuel) => ({ label: FUEL_LABELS[fuel], value: fuel })),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title={t("account.section")} styles={styles}>
        <AccountSection />
      </Section>

      <View style={styles.section}>
        <View style={styles.proCard}>
          <Pressable
            style={styles.proHeaderRow}
            onPress={() => !hasPurchased && setProExpanded((v) => !v)}
            accessibilityRole={hasPurchased ? undefined : "button"}
          >
            <View style={styles.proIconCircle}>
              <MaterialIcons name="verified" size={22} color={colors.accentOn} />
            </View>
            <View style={styles.proHeaderText}>
              <Text style={styles.proCardTitle}>{t("pro.title")}</Text>
            </View>
            {!hasPurchased && (
              <Ionicons
                name={proExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textMuted}
              />
            )}
          </Pressable>

          {!hasPurchased && proExpanded && (
            <>
              {trialActive && (
                <View style={styles.proStatusPill}>
                  <Text style={styles.proStatusPillText}>
                    {t("settings.proTrialActive", { days: trialDaysLeft })}
                  </Text>
                </View>
              )}
              <View style={styles.proPriceBlock}>
                <Text style={styles.proBigPrice}>{priceLabel || "—"}</Text>
                <Text style={styles.proPriceCaption}>{t("pro.oneTimeCaption")}</Text>
              </View>
              <View style={styles.proDivider} />
              <View style={styles.proFeatureList}>
                <View style={styles.proFeatureHeaderRow}>
                  <Text style={styles.proFeatureLabel} />
                  <Text style={styles.proFeatureColHeader}>{t("pro.free")}</Text>
                  <Text style={[styles.proFeatureColHeader, styles.proFeatureColHeaderPro]}>
                    {t("pro.title")}
                  </Text>
                </View>
                {PRO_FEATURES.map((feature) => (
                  <View key={feature.key} style={styles.proFeatureRow}>
                    <Text style={styles.proFeatureText}>{t(feature.featureKey)}</Text>
                    <View style={styles.proFeatureCol}>
                      <Ionicons name="remove" size={16} color={colors.textMuted} />
                    </View>
                    <View style={styles.proFeatureCol}>
                      <MaterialIcons name="verified" size={20} color={colors.accent} />
                    </View>
                  </View>
                ))}
              </View>

              {!trialActive && (
                <Text style={[styles.rowHint, styles.proHint]}>
                  {isSignedIn ? t("settings.proLockedHint") : t("settings.proSignInHint", { days: trialDaysLeft })}
                </Text>
              )}
              <Pressable style={styles.proButton} onPress={purchasePro}>
                <Text style={styles.proButtonText}>{t("pro.unlock")}</Text>
              </Pressable>
              <Pressable style={styles.proRestoreLink} onPress={restorePurchases} hitSlop={8}>
                <Text style={styles.proRestoreLinkText}>{t("settings.proRestore")}</Text>
              </Pressable>
            </>
          )}

          {hasPurchased && (
            <Text style={[styles.rowHint, styles.proHint]}>{t("settings.proUnlockedHint")}</Text>
          )}
        </View>
      </View>

      <Section title={t("settings.preferences")} styles={styles}>
        <Row styles={styles} icon="contrast-outline">
          <Text style={styles.rowLabel}>{t("settings.appearance")}</Text>
          <OptionDropdown
            title={t("settings.appearance")}
            icon="contrast-outline"
            options={themeOptions}
            value={mode}
            onChange={setMode}
          />
        </Row>
        <Row styles={styles} icon="language-outline" last>
          <Text style={styles.rowLabel}>{t("settings.language")}</Text>
          <OptionDropdown
            title={t("settings.language")}
            icon="language-outline"
            options={localeOptions}
            value={locale}
            onChange={setLocale}
          />
        </Row>
      </Section>

      <Section title={t("settings.defaultSearch")} styles={styles}>
        <View style={styles.defaultsBody}>
          <Text style={styles.defaultsHint}>{t("settings.defaultSearchHint")}</Text>
          <View style={styles.defaultsRow}>
            <OptionDropdown
              title={t("filter.fuelType")}
              icon="water-outline"
              options={fuelTypeOptions}
              value={fuelType}
              onChange={setFuelType}
            />
          </View>
        </View>
      </Section>

      <Section title={t("settings.permissions")} styles={styles}>
        <Row
          onPress={locationGranted ? undefined : fixLocationPermission}
          styles={styles}
          icon="location-outline"
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t("settings.locationAccess")}</Text>
            <Text style={styles.rowHint}>
              {locationStatus === null
                ? t("settings.locationChecking")
                : locationGranted
                  ? t("settings.locationGranted")
                  : t("settings.locationDenied")}
            </Text>
          </View>
          {!locationGranted && locationStatus !== null && (
            <View style={styles.fixChip}>
              <Text style={styles.fixText}>{t("settings.fix")}</Text>
            </View>
          )}
        </Row>
        <Row styles={styles} icon="notifications-outline" last>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t("settings.priceAlertNotifications")}</Text>
            <Text style={styles.rowHint}>{t("settings.onlyWhileOpen")}</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
        </Row>
      </Section>

      <Section title={t("settings.yourData")} styles={styles}>
        <Row
          onPress={favoriteCount > 0 ? confirmClearFavorites : undefined}
          styles={styles}
          icon="heart-outline"
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t("settings.favorites")}</Text>
            <Text style={styles.rowHint}>{t("settings.savedCount", { count: favoriteCount })}</Text>
          </View>
          {favoriteCount > 0 && <Text style={styles.destructiveText}>{t("settings.clear")}</Text>}
        </Row>
        <Row
          onPress={alarmCount > 0 ? confirmClearAlarms : undefined}
          styles={styles}
          icon="notifications-outline"
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t("settings.priceAlerts")}</Text>
            <Text style={styles.rowHint}>{t("settings.activeCount", { count: alarmCount })}</Text>
          </View>
          {alarmCount > 0 && <Text style={styles.destructiveText}>{t("settings.clear")}</Text>}
        </Row>
        <Row
          onPress={savingsEvents.length > 0 ? confirmClearSavings : undefined}
          styles={styles}
          icon="wallet-outline"
          last
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t("settings.savingsHistory")}</Text>
            <Text style={styles.rowHint}>
              {t("settings.savingsCount", { count: savingsEvents.length })}
            </Text>
          </View>
          {savingsEvents.length > 0 && <Text style={styles.destructiveText}>{t("settings.clear")}</Text>}
        </Row>
      </Section>

      <Section title={t("settings.about")} styles={styles}>
        <Row styles={styles} icon="information-circle-outline">
          <Text style={styles.rowLabel}>{t("settings.version")}</Text>
          <Text style={styles.rowHint}>{version}</Text>
        </Row>
        <Row onPress={() => requestAppReview()} styles={styles} icon="star-outline">
          <Text style={styles.rowLabel}>{t("settings.rate")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
        <Row
          onPress={() => shareApp(t("review.shareMessage"))}
          styles={styles}
          icon="share-social-outline"
        >
          <Text style={styles.rowLabel}>{t("settings.tellFriend")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
        <Row
          onPress={() => navigation.navigate("PrivacyPolicy")}
          styles={styles}
          icon="shield-checkmark-outline"
        >
          <Text style={styles.rowLabel}>{t("legal.privacyPolicy")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
        <Row
          onPress={() => navigation.navigate("Terms")}
          styles={styles}
          icon="document-text-outline"
        >
          <Text style={styles.rowLabel}>{t("legal.terms")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
        <Row
          onPress={() => navigation.navigate("Licenses")}
          styles={styles}
          icon="code-slash-outline"
          last
        >
          <Text style={styles.rowLabel}>{t("legal.licenses")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
      </Section>

      {TEST_TOOLS && <TestToolsSection />}
    </ScrollView>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  children,
  onPress,
  styles,
  last,
  icon,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
  last?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const rowStyle = [styles.row, last && styles.rowLast];
  const content = (
    <>
      {icon && <Ionicons name={icon} size={19} style={styles.rowIcon} />}
      {children}
    </>
  );
  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }
  return (
    <Pressable style={rowStyle} onPress={onPress}>
      {content}
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
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
    sectionBody: {
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
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { color: colors.textSecondary, width: 24, marginRight: spacing.sm + 2 },
    rowInfo: { flex: 1 },
    rowLabel: { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
    rowHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    destructiveText: { fontSize: 14, color: colors.danger, fontWeight: "600" },
    fixChip: {
      backgroundColor: colors.pillInactive,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
    },
    fixText: { fontSize: 13, color: colors.accent, fontWeight: "700" },
    proCard: {
      padding: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    proHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    proIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    proHeaderText: { flex: 1 },
    proCardTitle: { fontSize: 17, color: colors.textPrimary, fontWeight: "800" },
    proStatusPill: {
      alignSelf: "center",
      backgroundColor: colors.accentMuted,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      marginTop: spacing.md,
    },
    proStatusPillText: { fontSize: 12, fontWeight: "700", color: colors.accent },
    proPriceBlock: { marginTop: spacing.lg, alignItems: "center" },
    proBigPrice: { fontSize: 32, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
    proPriceCaption: {
      fontSize: 12.5,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    proDivider: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderStyle: "dashed",
    },
    proFeatureList: { marginTop: spacing.lg },
    proFeatureHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: spacing.sm + 2,
    },
    proFeatureLabel: { flex: 1 },
    proFeatureColHeader: {
      width: 48,
      textAlign: "center",
      fontSize: 10.5,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    proFeatureColHeaderPro: { color: colors.accent },
    proFeatureRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.xs + 2,
    },
    proFeatureCol: { width: 48, alignItems: "center" },
    proFeatureText: { flex: 1, fontSize: 13.5, color: colors.textPrimary, fontWeight: "600" },
    proHint: { marginTop: spacing.md },
    proRestoreLink: { alignItems: "center", marginTop: spacing.sm, padding: spacing.xs },
    proRestoreLinkText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    proButton: {
      marginTop: spacing.md,
      backgroundColor: colors.accent,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 3,
      alignSelf: "stretch",
      alignItems: "center",
    },
    proButtonText: { color: colors.accentOn, fontWeight: "700", fontSize: 14 },
    defaultsBody: { padding: spacing.lg, gap: spacing.md },
    defaultsHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    defaultsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  });
}
