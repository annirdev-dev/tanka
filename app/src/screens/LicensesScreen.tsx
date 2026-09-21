import React from "react";
import { LegalScreen } from "../components/LegalScreen";
import { licenses } from "../legal/content";

export function LicensesScreen() {
  return <LegalScreen doc={licenses} />;
}
