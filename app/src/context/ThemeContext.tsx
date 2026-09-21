import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ColorScheme, darkColors, lightColors } from "../theme";

const STORAGE_KEY = "tanken:theme-mode";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedScheme: "light" | "dark";
  colors: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always starts light regardless of the OS appearance — users can still
  // switch to dark manually, and that choice is what persists below.
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "light" || raw === "dark") setMode(raw);
    });
  }, []);

  const setModeAndSave = (next: ThemeMode) => {
    setMode(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const colors = mode === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, setMode: setModeAndSave, resolvedScheme: mode, colors }),
    [mode, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
