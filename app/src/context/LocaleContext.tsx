import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations, TranslationKey } from "../i18n/translations";

const STORAGE_KEY = "tanka:locale";

export type Locale = "de" | "en";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

// Defaults to German — the app's primary market is Germany (Tankerkoenig only
// covers German fuel stations) — with English available as an alternative.
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("de");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "de" || raw === "en") setLocale(raw);
    });
  }, []);

  const setLocaleAndSave = (next: Locale) => {
    setLocale(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
    let text = translations[locale][key];
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replace(`{{${name}}}`, String(value));
      }
    }
    return text;
  };

  const value = useMemo(() => ({ locale, setLocale: setLocaleAndSave, t }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
