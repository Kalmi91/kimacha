const { patchBuildGradle } = require('../withPlaySigning');

// The relevant part of the build.gradle that `expo prebuild` generates.
const TEMPLATE = `
def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'

android {
    ndkVersion rootProject.ext.ndkVersion
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('withPlaySigning.patchBuildGradle', () => {
  const out: string = patchBuildGradle(TEMPLATE);

  it('signs release with the upload key only for -PplayStore=true', () => {
    expect(out).toContain('signingConfig playStoreBuild ? signingConfigs.release : signingConfigs.debug');
    expect(out).toContain("findProperty('playStore')");
    expect(out).toContain('release {\n                storeFile playKeystoreFile');
  });

  it('keeps the debug build on the debug key', () => {
    expect(out).toMatch(/debug \{\n\s+signingConfig signingConfigs\.debug\n\s+\}/);
  });

  it('reads KIMACHA_KEYSTORE_PROPERTIES and fails the build when the file is missing', () => {
    expect(out).toContain("System.getenv('KIMACHA_KEYSTORE_PROPERTIES')");
    expect(out).toContain('/.kimacha/keystore.properties');
    expect(out).toContain('throw new GradleException');
  });

  it('turns the backslashes of a Windows storeFile into forward slashes before loading the properties', () => {
    expect(out).toContain(String.raw`line.matches(/\s*storeFile\s*[=:].*/)`);
    expect(out).toContain(".replace('\\\\', '/')");
    expect(out).toContain('playKeystoreProps.load(new StringReader(propsText))');
  });

  it('puts the helper before the android block and is idempotent', () => {
    expect(out.indexOf('def playStoreBuild')).toBeLessThan(out.indexOf('\nandroid {'));
    expect(patchBuildGradle(out)).toBe(out);
  });

  it('copes with a nested block that another plugin put into the release build type', () => {
    const nested = TEMPLATE.replace('        release {\n', "        release {\n            ndk {\n                debugSymbolLevel 'SYMBOL_TABLE'\n            }\n");
    expect(patchBuildGradle(nested)).toContain('signingConfig playStoreBuild ? signingConfigs.release');
  });

  it('throws when the template no longer has the expected anchors', () => {
    expect(() => patchBuildGradle('android {\n}\n')).toThrow('anchor not found');
  });
});
