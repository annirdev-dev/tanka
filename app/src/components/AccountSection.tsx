import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { usePurchase } from "../context/PurchaseContext";
import { useLocale } from "../context/LocaleContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { radii, spacing, ColorScheme } from "../theme";

// @react-native-google-signin/google-signin is a native module that isn't
// present in Expo Go's binary — importing it there throws immediately.
// Only load it in a real dev/standalone build, where the native code exists.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GoogleSigninModule = isExpoGo ? null : require("@react-native-google-signin/google-signin");

if (GoogleSigninModule) {
  GoogleSigninModule.GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  });
}

function formatAppleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    if (initials) return initials;
  }
  return email?.trim()[0]?.toUpperCase() ?? "?";
}

export function AccountSection({ showHint = true }: { showHint?: boolean } = {}) {
  const { token, user, signOut, deleteAccount } = useAuth();
  const { clearLocalPurchase } = usePurchase();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

  const handleApple = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token returned");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;

      // Apple only sends the name on the very first authorization, and only to
      // the client — persist it to the user's profile so it isn't lost.
      const name = formatAppleName(credential.fullName);
      if (name) await supabase.auth.updateUser({ data: { full_name: name } });
    } catch (err) {
      if ((err as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        console.error("Apple sign-in failed:", err);
        Alert.alert(t("account.signInError"), String((err as Error)?.message ?? err));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!GoogleSigninModule) {
      Alert.alert(t("account.needsDevBuild"));
      return;
    }
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = GoogleSigninModule;
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) {
        console.error("Google sign-in: no ID token in response", response);
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.data.idToken,
      });
      if (error) throw error;
    } catch (err) {
      if (!isErrorWithCode(err) || (err as { code: string }).code !== statusCodes.SIGN_IN_CANCELLED) {
        console.error("Google sign-in failed:", err);
        Alert.alert(t("account.signInError"), String((err as Error)?.message ?? err));
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(t("account.signOutConfirmTitle"), t("account.signOutConfirmMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.signOut"), style: "destructive", onPress: () => signOut() },
    ]);
  };

  // Asks Apple to confirm it is really the account owner, which gives us the
  // authorization code needed to remove Apple's link. Returns the code,
  // undefined if Apple failed for some reason other than the user backing out
  // (deletion carries on without it), or "cancelled" if the user backed out.
  const confirmWithApple = async (): Promise<string | undefined | "cancelled"> => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // The confirmation alert that was just tapped is still animating away;
    // presenting Apple's sheet on top of it can make iOS cancel the request.
    await wait(600);
    for (let attempt = 0; attempt < 2; attempt++) {
      const startedAt = Date.now();
      try {
        const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
        return credential.authorizationCode ?? undefined;
      } catch (err) {
        const canceled = (err as { code?: string }).code === "ERR_REQUEST_CANCELED";
        if (!canceled) {
          // Any other Apple hiccup must not leave someone unable to erase their
          // data — carry on; the backend logs that the link wasn't revoked.
          console.error("Apple re-authentication failed:", err);
          return undefined;
        }
        // "Cancelled" within a moment of opening is the sheet clashing with the
        // alert, not the user: try once more before treating it as a real cancel.
        if (attempt === 0 && Date.now() - startedAt < 1500) {
          await wait(700);
          continue;
        }
        return "cancelled";
      }
    }
    return "cancelled";
  };

  const confirmDeleteAccount = () => {
    const usesApple = !!user?.providers.includes("apple");
    Alert.alert(
      t("account.deleteAccountConfirmTitle"),
      t(usesApple ? "account.deleteAccountConfirmMsgApple" : "account.deleteAccountConfirmMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.delete"),
          style: "destructive",
          onPress: async () => {
            // Accounts created with Apple must be confirmed with Apple again, so
            // we get a fresh authorization code to revoke Apple's link with.
            let appleCode: string | undefined;
            if (usesApple) {
              const result = await confirmWithApple();
              if (result === "cancelled") {
                Alert.alert(t("account.deleteAppleCancelledTitle"), t("account.deleteAppleCancelledMsg"));
                return;
              }
              appleCode = result;
            }
            try {
              await deleteAccount(appleCode);
              // The account and its Pro record are gone — drop this device's local
              // Pro note too so the app starts over (the Apple ID still owns the
              // purchase, so Restore/Unlock brings Pro back without paying again).
              clearLocalPurchase();
            } catch {
              Alert.alert(t("account.deleteFailedTitle"), t("account.deleteFailedMsg"));
            }
          },
        },
      ]
    );
  };

  if (token && user) {
    const displayName = user.name ?? user.email ?? t("account.section");
    return (
      <View style={styles.body}>
        <View style={styles.profileRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user.name, user.email)}</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            {!!user.email && !!user.name && (
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user.email}
              </Text>
            )}
          </View>
          <Pressable
            style={styles.signOutButton}
            onPress={confirmSignOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("account.signOut")}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Pressable style={styles.deleteRow} onPress={confirmDeleteAccount} hitSlop={8}>
          <Ionicons name="trash-outline" size={13} color={colors.danger} />
          <Text style={styles.deleteText}>{t("account.deleteAccount")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      {showHint && (
        <View style={styles.hintRow}>
          <View style={styles.hintBadge}>
            <Ionicons name="sync-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.hint}>{t("account.syncHint")}</Text>
        </View>
      )}
      {busy ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.accent} />
      ) : (
        <View style={styles.buttonStack}>
          {Platform.OS === "ios" && (
            <>
              <Pressable style={styles.appleButton} onPress={handleApple}>
                <Ionicons name="logo-apple" size={18} color="#fff" />
                <Text style={styles.appleButtonText}>{t("account.signInApple")}</Text>
              </Pressable>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("pro.or")}</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}
          <Pressable style={styles.googleButton} onPress={handleGoogle}>
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleButtonText}>{t("account.signInGoogle")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    hintBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    hint: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    buttonStack: { gap: spacing.sm },
    appleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#000",
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 4,
    },
    appleButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: 2 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    dividerText: { fontSize: 11, color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 4,
    },
    googleButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatarRing: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.accentMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
    profileInfo: { flex: 1, minWidth: 0 },
    profileName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    profileEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    signOutButton: { padding: spacing.xs },
    deleteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: spacing.md,
    },
    deleteText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  });
}
