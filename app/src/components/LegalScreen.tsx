import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useLocale } from "../context/LocaleContext";
import { LegalDoc } from "../legal/content";
import { spacing, ColorScheme } from "../theme";

export function LegalScreen({ doc }: { doc: { de: LegalDoc; en: LegalDoc } }) {
  const { locale } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const content = doc[locale];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {content.updated ? <Text style={styles.updated}>{content.updated}</Text> : null}
      {content.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl, paddingBottom: spacing.xl * 2 },
    updated: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg },
    section: { marginBottom: spacing.lg },
    heading: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
    body: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  });
}
