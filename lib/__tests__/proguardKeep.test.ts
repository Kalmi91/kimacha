// The sherpa-onnx native code reads its Java config classes (OfflineTtsConfig and the model configs below it)
// field by field over JNI. The release build minifies with R8, and the sherpa classes come from a classes.jar
// extracted out of the AAR, so the AAR's own keep rules never reach the app: R8 renamed the fields, the
// JNI lookup got a null field id and the app aborted on the first better-voice load (4.1.29, at start-up,
// right after the word pack's recording). The keep rules live in app.json, expo-build-properties writes
// them into android/app/proguard-rules.pro at prebuild.

const appJson = require('../../app.json');

function extraProguardRules(): string {
  const plugin = (appJson.expo.plugins as unknown[]).find(
    (p): p is [string, { android?: { extraProguardRules?: string; enableMinifyInReleaseBuilds?: boolean } }] =>
      Array.isArray(p) && p[0] === 'expo-build-properties',
  );
  return plugin?.[1].android?.extraProguardRules ?? '';
}

describe('release minification keeps the classes native code reaches over JNI', () => {
  it('keeps the sherpa-onnx Java API and the React Native module whole', () => {
    const rules = extraProguardRules().split('\n').map(line => line.trim());
    expect(rules).toContain('-keep class com.k2fsa.sherpa.onnx.** { *; }');
    expect(rules).toContain('-keep class com.sherpaonnx.** { *; }');
  });
});
