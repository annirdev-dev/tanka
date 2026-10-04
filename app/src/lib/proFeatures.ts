import { TranslationKey } from "../i18n/translations";

export interface ProFeature {
  key: string;
  pitchKey: TranslationKey;
  featureKey: TranslationKey;
}

// Single source of truth for what Tanka Pro includes — shown as a checklist
// in both the paywall modal and the Settings Pro card, so the two never
// drift out of sync with each other.
export const PRO_FEATURES: ProFeature[] = [
  { key: "compare", pitchKey: "pro.pitch.compare", featureKey: "pro.feature.compare" },
  { key: "favorites", pitchKey: "pro.pitch.favorites", featureKey: "pro.feature.favorites" },
  { key: "alerts", pitchKey: "pro.pitch.alerts", featureKey: "pro.feature.alerts" },
  { key: "onMyWay", pitchKey: "pro.pitch.onMyWay", featureKey: "pro.feature.onMyWay" },
  { key: "savings", pitchKey: "pro.pitch.savings", featureKey: "pro.feature.savings" },
];
