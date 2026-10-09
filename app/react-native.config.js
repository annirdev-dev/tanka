// Meta's SDK is iPhone-only in Tanka: keep it out of the Android build.
module.exports = {
  dependencies: {
    "react-native-fbsdk-next": {
      platforms: {
        android: null,
      },
    },
  },
};
