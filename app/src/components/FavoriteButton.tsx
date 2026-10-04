import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { usePurchase } from "../context/PurchaseContext";

export function FavoriteButton({
  active,
  onPress,
  size = 22,
}: {
  active: boolean;
  onPress: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const { hasPro, presentPaywall } = usePurchase();
  return (
    <Pressable
      onPress={hasPro ? onPress : () => presentPaywall("favorites")}
      hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
      style={styles.button}
    >
      <Ionicons
        name={active ? "heart" : "heart-outline"}
        size={size}
        color={active ? colors.favorite : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 6 },
});
