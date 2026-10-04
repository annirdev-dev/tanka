import * as Updates from "expo-updates";

// Switch for the on-device test tools (fake location, end/restart trial,
// manual update check). On in exactly two situations, neither of which is the
// App Store build:
//  - EXPO_PUBLIC_TEST_TOOLS=1, for local development (`.env` / Metro);
//  - the build's own update channel is "testflight" — fixed when the build is
//    made with the `testflight` EAS profile, so it also holds for over-the-air
//    updates on that channel without depending on how they were bundled.
// The `production` profile builds on channel "production", so real users can
// never get these tools.
export const TEST_TOOLS =
  process.env.EXPO_PUBLIC_TEST_TOOLS === "1" || Updates.channel === "testflight";
