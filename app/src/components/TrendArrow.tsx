import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TrendInfo } from "../types/station";
import { useTheme } from "../context/ThemeContext";

export function TrendArrow({ trend }: { trend: TrendInfo | null | undefined }) {
  const { colors } = useTheme();
  if (!trend || trend.direction === "flat") return null;

  const isUp = trend.direction === "up";
  const color = isUp ? colors.expensive : colors.cheap;

  return (
    <View style={styles.row}>
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={color} />
      <Text style={[styles.delta, { color }]}>{Math.abs(trend.delta).toFixed(3)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  delta: { fontSize: 11, fontWeight: "600" },
});
