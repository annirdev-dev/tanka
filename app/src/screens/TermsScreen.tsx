import React from "react";
import { LegalScreen } from "../components/LegalScreen";
import { terms } from "../legal/content";

export function TermsScreen() {
  return <LegalScreen doc={terms} />;
}
