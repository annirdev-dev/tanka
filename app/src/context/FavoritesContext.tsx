import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Station } from "../types/station";

const STORAGE_KEY = "tanka:favorites";

interface FavoritesContextValue {
  favorites: Record<string, Station>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (station: Station) => void;
  updateFavoritePrices: (updates: Record<string, Partial<Station>>) => void;
  replaceFavorites: (favorites: Record<string, Station>) => void;
  clearAllFavorites: () => void;
  loaded: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Record<string, Station>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFavorites(JSON.parse(raw));
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, loaded]);

  const isFavorite = (id: string) => Boolean(favorites[id]);

  const toggleFavorite = (station: Station) => {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[station.id]) {
        delete next[station.id];
      } else {
        next[station.id] = station;
      }
      return next;
    });
  };

  const updateFavoritePrices = (updates: Record<string, Partial<Station>>) => {
    setFavorites((prev) => {
      const next = { ...prev };
      for (const [id, patch] of Object.entries(updates)) {
        if (next[id]) next[id] = { ...next[id], ...patch };
      }
      return next;
    });
  };

  const clearAllFavorites = () => setFavorites({});
  const replaceFavorites = (next: Record<string, Station>) => setFavorites(next);

  const value = useMemo(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      updateFavoritePrices,
      replaceFavorites,
      clearAllFavorites,
      loaded,
    }),
    [favorites, loaded]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
