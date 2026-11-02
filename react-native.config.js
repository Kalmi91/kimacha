// react-native-sherpa-onnx lists @kesha-antonov/react-native-background-downloader as a peer, but its native
// code never calls it (only its JS `download` entry does, which the app does not import; the app downloads
// with react-native-fs). Linked, the downloader would put FOREGROUND_SERVICE(_DATA_SYNC), WAKE_LOCK and
// RUN_USER_INITIATED_JOBS plus a dataSync service into the release manifest, so it is kept out of the
// Android autolinking.
module.exports = {
  dependencies: {
    '@kesha-antonov/react-native-background-downloader': {
      platforms: { android: null },
    },
  },
};
