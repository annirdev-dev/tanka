import React from "react";
import { LegalScreen } from "../components/LegalScreen";
import { privacyPolicy } from "../legal/content";

export function PrivacyPolicyScreen() {
  return <LegalScreen doc={privacyPolicy} />;
}
