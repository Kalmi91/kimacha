// Expo config plugin: Google Play upload-key signing for the generated android/ project.
//
// `expo prebuild` regenerates android/ and signs the release build with the public React
// Native debug key. That stays the default: it keeps the sideloaded APK updatable.
// With the Gradle property `-PplayStore=true` the release build is signed with the
// upload key instead. The key is described by a keystore.properties file kept outside
// the repository: path from the env var KIMACHA_KEYSTORE_PROPERTIES, default
// <user home>/.kimacha/keystore.properties. A missing or incomplete file fails the build.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// kimacha-play-signing';

const HELPER = [
  MARKER,
  "def playStoreBuild = (findProperty('playStore') ?: 'false').toString() == 'true'",
  'def playKeystoreProps = new Properties()',
  'def playKeystoreFile = null',
  'if (playStoreBuild) {',
  "    def propsPath = System.getenv('KIMACHA_KEYSTORE_PROPERTIES') ?: \"${System.getProperty('user.home')}/.kimacha/keystore.properties\"",
  '    def propsFile = new File(propsPath)',
  '    if (!propsFile.isFile()) {',
  '        throw new GradleException("Play Store build (-PplayStore=true) needs the upload keystore description at ${propsFile}, but that file does not exist. Create it (storeFile, storePassword, keyAlias, keyPassword; see README, Release process) or point KIMACHA_KEYSTORE_PROPERTIES at it.")',
  '    }',
  '    propsFile.withInputStream { playKeystoreProps.load(it) }',
  "    ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].each { key ->",
  '        if (!playKeystoreProps.getProperty(key)) {',
  '            throw new GradleException("Play Store build: ${propsFile} has no value for ${key}.")',
  '        }',
  '    }',
  "    def configuredStore = new File(playKeystoreProps.getProperty('storeFile'))",
  '    playKeystoreFile = configuredStore.isAbsolute() ? configuredStore : new File(propsFile.parentFile, configuredStore.path)',
  '    if (!playKeystoreFile.isFile()) {',
  '        throw new GradleException("Play Store build: the keystore ${playKeystoreFile} (storeFile in ${propsFile}) does not exist.")',
  '    }',
  '}',
  '',
  '',
].join('\n');

const SIGNING_RELEASE = [
  '        if (playStoreBuild) {',
  '            release {',
  '                storeFile playKeystoreFile',
  "                storePassword playKeystoreProps.getProperty('storePassword')",
  "                keyAlias playKeystoreProps.getProperty('keyAlias')",
  "                keyPassword playKeystoreProps.getProperty('keyPassword')",
  '            }',
  '        }',
  '',
].join('\n');

// Each anchor must match, otherwise a template change would silently ship a
// debug-signed Play build; fail loudly instead.
function patchBuildGradle(src) {
  if (src.includes(MARKER)) return src;
  let out = src;

  const useKey = out.replace(
    /(^ {8}release \{\n(?: {9,}.*\n)*? {12}signingConfig )signingConfigs\.debug/m,
    '$1playStoreBuild ? signingConfigs.release : signingConfigs.debug'
  );
  if (useKey === out) throw new Error('withPlaySigning: buildTypes.release signingConfig anchor not found');
  out = useKey;

  const withBlock = out.replace(/(^ *signingConfigs \{\n)/m, `$1${SIGNING_RELEASE}`);
  if (withBlock === out) throw new Error('withPlaySigning: signingConfigs anchor not found');
  out = withBlock;

  const withHelper = out.replace(/^android \{/m, () => `${HELPER}android {`);
  if (withHelper === out) throw new Error('withPlaySigning: android block anchor not found');
  return withHelper;
}

const withPlaySigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withPlaySigning: expected a Groovy android/app/build.gradle');
    }
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });

module.exports = withPlaySigning;
module.exports.patchBuildGradle = patchBuildGradle;
