import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { fetchStationHistory } from "../api/client";
import { FuelType, HistoryPoint, HistoryRange } from "../types/station";
import { radii, spacing, ColorScheme } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";

const RANGES: HistoryRange[] = ["12h", "24h", "3d", "1w"];

const CHART_HEIGHT = 100;
const CHART_WIDTH = 300;
const PADDING = 10;

export function PriceHistoryChart({ stationId, fuelType }: { stationId: string; fuelType: FuelType }) {
  const [range, setRange] = useState<HistoryRange>("24h");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStationHistory(stationId, range)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, range]);

  const points = useMemo(() => {
    if (fuelType === "all") return [];
    return history
      .filter((h) => h.fuelType === fuelType)
      .sort((a, b) => a.recordedAt - b.recordedAt);
  }, [history, fuelType]);

  const path = useMemo(() => {
    if (points.length < 2) return null;
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 0.01;
    const times = points.map((p) => p.recordedAt);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const spanT = maxT - minT || 1;

    const coords = points.map((p) => {
      const x = PADDING + ((p.recordedAt - minT) / spanT) * (CHART_WIDTH - PADDING * 2);
      const y = CHART_HEIGHT - PADDING - ((p.price - min) / span) * (CHART_HEIGHT - PADDING * 2);
      return { x, y };
    });

    return { coords, min, max };
  }, [points]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("history.title")}</Text>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangePill, range === r && styles.rangePillActive]}
            >
              <Text style={[styles.rangeLabel, range === r && styles.rangeLabelActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyChart}>
          <ActivityIndicator size="small" />
        </View>
      ) : !path ? (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>{t("history.noData")}</Text>
        </View>
      ) : (
        <View>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Line
              x1={PADDING}
              y1={CHART_HEIGHT - PADDING}
              x2={CHART_WIDTH - PADDING}
              y2={CHART_HEIGHT - PADDING}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Polyline
              points={path.coords.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
            />
            <Circle
              cx={path.coords[path.coords.length - 1].x}
              cy={path.coords[path.coords.length - 1].y}
              r={3.5}
              fill={colors.accent}
            />
          </Svg>
          <View style={styles.minMaxRow}>
            <Text style={styles.minMaxText}>{path.min.toFixed(3)} €</Text>
            <Text style={styles.minMaxText}>{path.max.toFixed(3)} €</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    title: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    rangeRow: { flexDirection: "row", gap: 6 },
    rangePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.pillInactive },
    rangePillActive: { backgroundColor: colors.accent },
    rangeLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    rangeLabelActive: { color: colors.accentOn },
    emptyChart: { height: CHART_HEIGHT, alignItems: "center", justifyContent: "center" },
    emptyText: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
    minMaxRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    minMaxText: { fontSize: 11, color: colors.textMuted },
  });
}
