import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { LocaleProvider } from "./src/context/LocaleContext";
import { StationFiltersProvider } from "./src/context/StationFiltersContext";
import { LocationOverrideProvider } from "./src/context/LocationOverrideContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import { AlarmsProvider } from "./src/context/AlarmsContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PurchaseProvider, usePurchase } from "./src/context/PurchaseContext";
import { SyncCoordinator } from "./src/context/SyncCoordinator";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ProPaywallModal } from "./src/components/ProPaywallModal";
import { AppReviewPrompt } from "./src/components/AppReviewPrompt";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";

// Set once, the first time a user ever signs in OR buys Pro outright.
// Onboarding is a one-time gate — either path proves they're past it, and
// neither signing out nor anything else brings this screen back afterwards,
// since Map/prices/directions stay free regardless of sign-in state.
const ONBOARDING_KEY = "tanken:onboarded";

function AppContent() {
  const { resolvedScheme, colors } = useTheme();
  const { token, loading: authLoading } = useAuth();
  const { hasPurchased } = usePurchase();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((raw) => setOnboarded(raw === "true"));
  }, []);

  // The moment they sign in or buy Pro outright, latch onboarding as done.
  useEffect(() => {
    if ((token || hasPurchased) && onboarded === false) {
      setOnboarded(true);
      AsyncStorage.setItem(ONBOARDING_KEY, "true").catch(() => undefined);
    }
  }, [token, hasPurchased, onboarded]);

  if (authLoading || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!onboarded && !token && !hasPurchased) {
    return <OnboardingScreen />;
  }

  return (
    <>
      <SyncCoordinator />
      <RootNavigator />
      <ProPaywallModal />
      <AppReviewPrompt />
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <FavoritesProvider>
            <AlarmsProvider>
              <AuthProvider>
                <StationFiltersProvider>
                  <LocationOverrideProvider>
                    <PurchaseProvider>
                      <AppContent />
                    </PurchaseProvider>
                  </LocationOverrideProvider>
                </StationFiltersProvider>
              </AuthProvider>
            </AlarmsProvider>
          </FavoritesProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
