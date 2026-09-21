export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

// Contact/entity placeholders — fill these in with your real details before publishing.
const CONTACT_EMAIL = "annirdev@gmail.com";
const ENTITY_NAME = "Annir Dev";

export const privacyPolicy: { de: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: 2026",
    sections: [
      {
        heading: "Overview",
        body: `Tanken ("the app") helps you find and compare fuel prices at gas stations in Germany. This policy explains what data the app collects, why, and how it's handled. The app is operated by ${ENTITY_NAME}.`,
      },
      {
        heading: "Location data",
        body: "The app requests your device location to find fuel stations near you. Your coordinates are sent to our backend server only to query the Tankerkönig API for nearby stations — they are not stored, logged, or shared with anyone beyond that single request. You can deny or revoke location access at any time in your device Settings; the app will not function without it.",
      },
      {
        heading: "Data stored on your device",
        body: "Your favorite stations, price alerts, and app preferences (fuel type, theme, language) are stored locally on your device. This data is not sent anywhere unless you choose to sign in (see below).",
      },
      {
        heading: "Account & sync (optional)",
        body: "If you choose to sign in with Apple or Google, we receive your name and email address (or a private relay address, if you use Apple's \"Hide My Email\") from that provider, solely to identify your account. Your account, favorites, and price alerts are then stored with Supabase, our backend infrastructure provider (authentication and database hosting), so you can access them on multiple devices. Supabase processes this data only on our behalf and does not use it for its own purposes. We never receive or store your Apple or Google password. You can delete your account and all synced data at any time from Settings.",
      },
      {
        heading: "Price data",
        body: "Fuel prices are provided by Tankerkönig (creativecommons.tankerkoenig.de), based on data from the Markttransparenzstelle für Kraftstoffe (MTS-K). We temporarily cache price responses on our server to reduce load on Tankerkönig's API, and keep a short price-history log per station (price and timestamp only, not linked to you) to power the in-app price chart.",
      },
      {
        heading: "Notifications",
        body: "Price alerts are delivered as local notifications generated on your own device while the app is open. We do not use a push notification service and cannot see or access the content of these notifications.",
      },
      {
        heading: "What we don't do",
        body: "We don't show ads, use analytics or tracking SDKs, or sell or share your data with advertisers or data brokers. The only third parties involved are Tankerkönig (fuel price data), Supabase (backend infrastructure for account and data storage), and Apple/Google (only if you choose to sign in).",
      },
      {
        heading: "Your rights",
        body: "You can clear your favorites and price alerts at any time from Settings. If you have an account, you can request deletion of your account and all associated data from Settings, or by contacting us. If you are in the EU/EEA, you have rights under the GDPR including access, correction, and erasure of your data.",
      },
      {
        heading: "Changes to this policy",
        body: "We may update this policy from time to time. Material changes will be reflected by updating the date above.",
      },
      {
        heading: "Contact",
        body: `Questions about this policy? Contact ${CONTACT_EMAIL}.`,
      },
    ],
  },
  de: {
    title: "Datenschutzerklärung",
    updated: "Zuletzt aktualisiert: 2026",
    sections: [
      {
        heading: "Überblick",
        body: `Tanken („die App") hilft dir, Kraftstoffpreise an Tankstellen in Deutschland zu finden und zu vergleichen. Diese Erklärung beschreibt, welche Daten die App erhebt, warum, und wie sie verarbeitet werden. Betreiber der App ist ${ENTITY_NAME}.`,
      },
      {
        heading: "Standortdaten",
        body: "Die App fragt deinen Gerätestandort ab, um Tankstellen in deiner Nähe zu finden. Deine Koordinaten werden nur an unseren Backend-Server gesendet, um die Tankerkönig-API nach nahegelegenen Tankstellen abzufragen — sie werden nicht gespeichert, protokolliert oder über diese eine Anfrage hinaus weitergegeben. Du kannst den Standortzugriff jederzeit in den Geräteeinstellungen verweigern oder widerrufen; die App funktioniert dann jedoch nicht.",
      },
      {
        heading: "Auf deinem Gerät gespeicherte Daten",
        body: "Deine favorisierten Tankstellen, Preisalarme und App-Einstellungen (Kraftstoffart, Design, Sprache) werden lokal auf deinem Gerät gespeichert. Diese Daten werden nirgendwohin gesendet, es sei denn, du meldest dich an (siehe unten).",
      },
      {
        heading: "Konto & Synchronisierung (optional)",
        body: "Wenn du dich mit Apple oder Google anmeldest, erhalten wir deinen Namen und deine E-Mail-Adresse (oder eine private Weiterleitungsadresse, falls du Apples „E-Mail geheim halten\" nutzt) von diesem Anbieter, ausschließlich zur Identifizierung deines Kontos. Dein Konto sowie deine Favoriten und Preisalarme werden bei Supabase gespeichert, unserem Backend-Infrastrukturanbieter für Authentifizierung und Datenbank, damit du auf mehreren Geräten darauf zugreifen kannst. Supabase verarbeitet diese Daten ausschließlich in unserem Auftrag und nutzt sie nicht für eigene Zwecke. Wir erhalten oder speichern niemals dein Apple- oder Google-Passwort. Du kannst dein Konto und alle synchronisierten Daten jederzeit in den Einstellungen löschen.",
      },
      {
        heading: "Preisdaten",
        body: "Kraftstoffpreise werden von Tankerkönig (creativecommons.tankerkoenig.de) bereitgestellt, basierend auf Daten der Markttransparenzstelle für Kraftstoffe (MTS-K). Wir zwischenspeichern Preisantworten vorübergehend auf unserem Server, um die Tankerkönig-API zu entlasten, und führen ein kurzes Preisverlaufs-Protokoll je Tankstelle (nur Preis und Zeitstempel, nicht mit dir verknüpft) für das Preisdiagramm in der App.",
      },
      {
        heading: "Benachrichtigungen",
        body: "Preisalarme werden als lokale Benachrichtigungen auf deinem eigenen Gerät erzeugt, solange die App geöffnet ist. Wir nutzen keinen Push-Benachrichtigungsdienst und können den Inhalt dieser Benachrichtigungen nicht einsehen.",
      },
      {
        heading: "Was wir nicht tun",
        body: "Wir zeigen keine Werbung, nutzen keine Analyse- oder Tracking-SDKs und verkaufen oder teilen deine Daten nicht mit Werbetreibenden oder Datenhändlern. Die einzigen beteiligten Dritten sind Tankerkönig (Kraftstoffpreisdaten), Supabase (Backend-Infrastruktur für Konto und Datenspeicherung) und Apple/Google (nur wenn du dich anmeldest).",
      },
      {
        heading: "Deine Rechte",
        body: "Du kannst deine Favoriten und Preisalarme jederzeit in den Einstellungen löschen. Falls du ein Konto hast, kannst du die Löschung deines Kontos und aller zugehörigen Daten in den Einstellungen oder durch Kontaktaufnahme beantragen. In der EU/EWR hast du gemäß DSGVO Rechte auf Auskunft, Berichtigung und Löschung deiner Daten.",
      },
      {
        heading: "Änderungen dieser Erklärung",
        body: "Wir können diese Erklärung von Zeit zu Zeit aktualisieren. Wesentliche Änderungen werden durch Aktualisierung des Datums oben kenntlich gemacht.",
      },
      {
        heading: "Kontakt",
        body: `Fragen zu dieser Erklärung? Kontaktiere ${CONTACT_EMAIL}.`,
      },
    ],
  },
};

export const terms: { de: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Terms of Use",
    updated: "Last updated: 2026",
    sections: [
      {
        heading: "Acceptance",
        body: `By using Tanken ("the app"), you agree to these terms. If you don't agree, please don't use the app. The app is operated by ${ENTITY_NAME}.`,
      },
      {
        heading: "What the app is",
        body: "Tanken shows fuel prices at gas stations in Germany, sourced from the Tankerkönig API, for informational purposes. Prices are reported by stations in near real-time but may occasionally be delayed, missing, or inaccurate. Always confirm the price at the pump before fueling — the app is not a substitute for that.",
      },
      {
        heading: "Accounts",
        body: "If you sign in, you're responsible for keeping your account secure and for all activity under it. You may request deletion of your account at any time. We may suspend or terminate accounts that abuse the service.",
      },
      {
        heading: "Acceptable use",
        body: "Don't use the app to scrape, resell, or redistribute the underlying price data in bulk, attempt to bypass rate limits, reverse-engineer the backend, or otherwise interfere with the service or Tankerkönig's API in ways that violate Tankerkönig's own terms of use.",
      },
      {
        heading: "No warranty",
        body: 'The app and its data are provided "as is," without warranties of any kind, express or implied, including accuracy, availability, or fitness for a particular purpose.',
      },
      {
        heading: "Limitation of liability",
        body: `To the maximum extent permitted by law, ${ENTITY_NAME} is not liable for any damages arising from your use of, or inability to use, the app, including reliance on price data that turns out to be inaccurate.`,
      },
      {
        heading: "Third-party services",
        body: "The app relies on Tankerkönig (fuel price data, licensed under CC BY 4.0) and, if you sign in, Apple or Google for authentication. Your use of those services is also subject to their own terms.",
      },
      {
        heading: "Changes",
        body: "We may update these terms from time to time. Continued use of the app after changes take effect means you accept the updated terms.",
      },
      {
        heading: "Contact",
        body: `Questions about these terms? Contact ${CONTACT_EMAIL}.`,
      },
    ],
  },
  de: {
    title: "Nutzungsbedingungen",
    updated: "Zuletzt aktualisiert: 2026",
    sections: [
      {
        heading: "Annahme der Bedingungen",
        body: `Durch die Nutzung von Tanken („die App") erklärst du dich mit diesen Bedingungen einverstanden. Wenn du nicht einverstanden bist, nutze die App bitte nicht. Betreiber der App ist ${ENTITY_NAME}.`,
      },
      {
        heading: "Was die App ist",
        body: "Tanken zeigt Kraftstoffpreise an Tankstellen in Deutschland an, bezogen von der Tankerkönig-API, zu Informationszwecken. Preise werden von den Tankstellen nahezu in Echtzeit gemeldet, können aber gelegentlich verzögert, fehlend oder ungenau sein. Bestätige den Preis immer an der Zapfsäule, bevor du tankst — die App ersetzt das nicht.",
      },
      {
        heading: "Konten",
        body: "Wenn du dich anmeldest, bist du für die Sicherheit deines Kontos und alle darüber ausgeführten Aktivitäten verantwortlich. Du kannst jederzeit die Löschung deines Kontos beantragen. Wir können Konten sperren oder löschen, die den Dienst missbrauchen.",
      },
      {
        heading: "Zulässige Nutzung",
        body: "Nutze die App nicht, um die zugrunde liegenden Preisdaten massenhaft abzugreifen, weiterzuverkaufen oder weiterzuverbreiten, Ratenbegrenzungen zu umgehen, das Backend zurückzuentwickeln oder den Dienst bzw. die Tankerkönig-API auf eine Weise zu stören, die gegen Tankerkönigs eigene Nutzungsbedingungen verstößt.",
      },
      {
        heading: "Keine Gewährleistung",
        body: "Die App und ihre Daten werden „wie besehen\" bereitgestellt, ohne Gewährleistung jeglicher Art, weder ausdrücklich noch stillschweigend, einschließlich Genauigkeit, Verfügbarkeit oder Eignung für einen bestimmten Zweck.",
      },
      {
        heading: "Haftungsbeschränkung",
        body: `Soweit gesetzlich zulässig, haftet ${ENTITY_NAME} nicht für Schäden, die aus der Nutzung oder Nichtnutzbarkeit der App entstehen, einschließlich des Vertrauens auf sich als ungenau herausstellende Preisdaten.`,
      },
      {
        heading: "Drittanbieterdienste",
        body: "Die App nutzt Tankerkönig (Kraftstoffpreisdaten, lizenziert unter CC BY 4.0) und, falls du dich anmeldest, Apple oder Google zur Authentifizierung. Deine Nutzung dieser Dienste unterliegt auch deren eigenen Bedingungen.",
      },
      {
        heading: "Änderungen",
        body: "Wir können diese Bedingungen von Zeit zu Zeit aktualisieren. Die fortgesetzte Nutzung der App nach Inkrafttreten von Änderungen bedeutet, dass du die aktualisierten Bedingungen akzeptierst.",
      },
      {
        heading: "Kontakt",
        body: `Fragen zu diesen Bedingungen? Kontaktiere ${CONTACT_EMAIL}.`,
      },
    ],
  },
};

export const licenses: { de: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Licenses & Attribution",
    updated: "",
    sections: [
      {
        heading: "Fuel price data",
        body: "Provided by Tankerkönig (creativecommons.tankerkoenig.de), based on data from the Markttransparenzstelle für Kraftstoffe (MTS-K) / Bundeskartellamt. Licensed under Creative Commons Attribution 4.0 (CC BY 4.0). See creativecommons.org/licenses/by/4.0.",
      },
      {
        heading: "Open-source software",
        body: "This app is built with React Native, Expo, and the following open-source packages, most under the MIT License: react-navigation, react-native-maps, react-native-svg, @react-native-async-storage/async-storage, @supabase/supabase-js, expo-location, expo-notifications, expo-apple-authentication, @react-native-google-signin/google-signin, expo-secure-store, @expo/vector-icons, and their dependencies. Full license texts are included in each package's repository.",
      },
      {
        heading: "Maps",
        body: "Map tiles and data are provided by Apple Maps (iOS) or Google Maps (Android), subject to their respective terms of service.",
      },
    ],
  },
  de: {
    title: "Lizenzen & Namensnennung",
    updated: "",
    sections: [
      {
        heading: "Kraftstoffpreisdaten",
        body: "Bereitgestellt von Tankerkönig (creativecommons.tankerkoenig.de), basierend auf Daten der Markttransparenzstelle für Kraftstoffe (MTS-K) / des Bundeskartellamts. Lizenziert unter Creative Commons Namensnennung 4.0 (CC BY 4.0). Siehe creativecommons.org/licenses/by/4.0/deed.de.",
      },
      {
        heading: "Open-Source-Software",
        body: "Diese App wurde mit React Native, Expo und den folgenden Open-Source-Paketen erstellt, größtenteils unter der MIT-Lizenz: react-navigation, react-native-maps, react-native-svg, @react-native-async-storage/async-storage, @supabase/supabase-js, expo-location, expo-notifications, expo-apple-authentication, @react-native-google-signin/google-signin, expo-secure-store, @expo/vector-icons und deren Abhängigkeiten. Vollständige Lizenztexte sind im jeweiligen Paket-Repository enthalten.",
      },
      {
        heading: "Karten",
        body: "Kartenkacheln und -daten werden von Apple Maps (iOS) bzw. Google Maps (Android) bereitgestellt und unterliegen deren jeweiligen Nutzungsbedingungen.",
      },
    ],
  },
};
