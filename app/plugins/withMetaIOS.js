// Adds Meta's (Facebook) SDK settings to the iPhone app only.
//
// react-native-fbsdk-next ships its own Expo plugin, but that one also edits the
// Android project. Tanka's Android build must stay exactly as it is, so this
// wrapper reuses only the package's iOS helpers and leaves Android alone
// (the package is also excluded from Android autolinking, see
// react-native.config.js).
//
// What it writes to Info.plist: Meta app ID, client token, display name, the
// fb<appID> URL scheme, automatic app-open logging on, advertising-ID
// collection off, and Meta's two SKAdNetwork IDs. It does NOT add the tracking
// prompt (NSUserTrackingUsageDescription).
const { withInfoPlist } = require("expo/config-plugins");
const fb = require("react-native-fbsdk-next/plugin/build/withFacebookIOS");
const {
  withSKAdNetworkIdentifiers,
} = require("react-native-fbsdk-next/plugin/build/withSKAdNetworkIdentifiers");

const META_SKADNETWORK_IDS = ["v9wttpbfk9.skadnetwork", "n38lu8286q.skadnetwork"];

module.exports = function withMetaIOS(config, { appID, clientToken, displayName }) {
  if (!appID || !clientToken || !displayName) {
    throw new Error("withMetaIOS needs appID, clientToken and displayName");
  }
  const settings = {
    appID,
    clientToken,
    displayName,
    scheme: `fb${appID}`,
    autoLogAppEventsEnabled: true,
    advertiserIDCollectionEnabled: false,
  };
  config = withInfoPlist(config, (c) => {
    let plist = c.modResults;
    plist = fb.setFacebookAppId(settings, plist);
    plist = fb.setFacebookClientToken(settings, plist);
    plist = fb.setFacebookDisplayName(settings, plist);
    plist = fb.setFacebookAutoLogAppEventsEnabled(settings, plist);
    plist = fb.setFacebookAdvertiserIDCollectionEnabled(settings, plist);
    plist = fb.setFacebookScheme(settings, plist);
    c.modResults = plist;
    return c;
  });
  return withSKAdNetworkIdentifiers(config, META_SKADNETWORK_IDS);
};
