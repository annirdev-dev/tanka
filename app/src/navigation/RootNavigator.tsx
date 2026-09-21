import React from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, TabParamList } from "./types";
import { MapScreen } from "../screens/MapScreen";
import { FavoritesScreen } from "../screens/FavoritesScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { StationDetailScreen } from "../screens/StationDetailScreen";
import { OnMyWayScreen } from "../screens/OnMyWayScreen";
import { PrivacyPolicyScreen } from "../screens/PrivacyPolicyScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { LicensesScreen } from "../screens/LicensesScreen";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Map: "map",
  Favorites: "heart",
  Alerts: "notifications",
  Settings: "settings",
};

function Tabs() {
  const { colors } = useTheme();
  const { t } = useLocale();

  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name] : (`${TAB_ICONS[route.name]}-outline` as keyof typeof Ionicons.glyphMap)}
            size={size}
            color={color}
          />
        ),
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t("tabs.map") }} />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: t("tabs.favorites") }}
      />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: t("tabs.alerts") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("tabs.settings") }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors, resolvedScheme } = useTheme();
  const { t } = useLocale();

  const navTheme = {
    ...(resolvedScheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolvedScheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.surface,
      card: colors.background,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="StationDetail"
          component={StationDetailScreen}
          options={{ title: t("tabs.stationDetail") }}
        />
        <Stack.Screen
          name="OnMyWay"
          component={OnMyWayScreen}
          options={{ title: t("onMyWay.title") }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ title: t("legal.privacyPolicy") }}
        />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ title: t("legal.terms") }} />
        <Stack.Screen
          name="Licenses"
          component={LicensesScreen}
          options={{ title: t("legal.licenses") }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
