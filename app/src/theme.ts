export interface ColorScheme {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentOn: string;
  pillInactive: string;
  cheap: string;
  cheapBg: string;
  mid: string;
  midBg: string;
  expensive: string;
  expensiveBg: string;
  closed: string;
  favorite: string;
  danger: string;
  overlay: string;
}

export const lightColors: ColorScheme = {
  background: "#ffffff",
  surface: "#f7f8fa",
  border: "#e8e9ec",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  accent: "#111827",
  accentOn: "#ffffff",
  pillInactive: "#f0f1f3",
  cheap: "#16a34a",
  cheapBg: "#eafbf1",
  mid: "#d97706",
  midBg: "#fef6e7",
  expensive: "#dc2626",
  expensiveBg: "#fdecec",
  closed: "#9ca3af",
  favorite: "#ef4444",
  danger: "#dc2626",
  overlay: "rgba(0,0,0,0.3)",
};

export const darkColors: ColorScheme = {
  background: "#1c1c1e",
  surface: "#121214",
  border: "#2e2e31",
  textPrimary: "#f2f2f3",
  textSecondary: "#a6a6ab",
  textMuted: "#77777c",
  accent: "#f2f2f3",
  accentOn: "#1c1c1e",
  pillInactive: "#2c2c2e",
  cheap: "#34d058",
  cheapBg: "#12291a",
  mid: "#f0a93a",
  midBg: "#2e2410",
  expensive: "#ef5a53",
  expensiveBg: "#2e1513",
  closed: "#77777c",
  favorite: "#ff6b6b",
  danger: "#ef5a53",
  overlay: "rgba(0,0,0,0.5)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
