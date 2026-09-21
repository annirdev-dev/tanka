import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
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

  const confirmDeleteAccount = () => {
    Alert.alert(t("account.deleteAccountConfirmTitle"), t("account.deleteAccountConfirmMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.delete"), style: "destructive", onPress: () => deleteAccount() },
    ]);
  };

  if (token && user) {
    const displayName = user.name ?? user.email ?? t("account.section");
    return (
      <View style={styles.body}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user.name, user.email)}</Text>
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
      {showHint && <Text style={styles.hint}>{t("account.syncHint")}</Text>}
      {busy ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} />
      ) : (
        <>
          {Platform.OS === "ios" && (
            <Pressable style={styles.appleButton} onPress={handleApple}>
              <Ionicons name="logo-apple" size={18} color="#fff" />
              <Text style={styles.appleButtonText}>{t("account.signInApple")}</Text>
            </Pressable>
          )}
          <Pressable style={styles.googleButton} onPress={handleGoogle}>
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleButtonText}>{t("account.signInGoogle")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.sm },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginBottom: spacing.xs },
    appleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#000",
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
    },
    appleButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
    },
    googleButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.accentOn, fontWeight: "700", fontSize: 16 },
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
