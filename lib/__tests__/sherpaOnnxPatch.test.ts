// scripts/patch-sherpa-onnx.mjs (postinstall) hands the language to the Kokoro config of
// react-native-sherpa-onnx 0.4.4, which builds it without one: the multi-language Kokoro model then reads a
// Spanish sentence with English phonemes. Without the patch the app still builds and speaks, with the
// wrong accent, so this test is what notices a missing or outdated patch.
import { readFileSync } from 'fs';
import { join } from 'path';

const helper = readFileSync(
  join(__dirname, '../../node_modules/react-native-sherpa-onnx/android/src/main/java/com/sherpaonnx/SherpaOnnxTtsHelper.kt'),
  'utf8',
);
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

describe('react-native-sherpa-onnx Kokoro language patch', () => {
  it('the modelType suffix ("kokoro@es-419") becomes the Kokoro lang in both Kokoro configs', () => {
    expect(helper).toContain('kimacha: kokoro language');
    expect(helper).toContain('modelType.split("@", limit = 2)');
    expect(helper.match(/lang = kokoroLang,/g)).toHaveLength(2);
  });

  it('a language other than English leaves the English lexicon out, so Spanish words are not read as English', () => {
    expect(helper.match(/lexicon = if \(kokoroLang\.isEmpty\(\) \|\| kokoroLang\.startsWith\("en"\)\) path\(paths, "lexicon"\) else ""/g)).toHaveLength(2);
  });

  it('postinstall runs it, so npm ci in CI and in the release worktree patches too', () => {
    expect(pkg.scripts.postinstall).toContain('scripts/patch-sherpa-onnx.mjs');
  });

  it('the package is pinned to the exact version the patch is written for: package.json, the lock, the script and the install agree', () => {
    const lock = JSON.parse(readFileSync(join(__dirname, '../../package-lock.json'), 'utf8'));
    const installed = JSON.parse(readFileSync(join(__dirname, '../../node_modules/react-native-sherpa-onnx/package.json'), 'utf8'));
    const script = readFileSync(join(__dirname, '../../scripts/patch-sherpa-onnx.mjs'), 'utf8');
    expect(pkg.dependencies['react-native-sherpa-onnx']).toBe('0.4.4');
    expect(lock.packages[''].dependencies['react-native-sherpa-onnx']).toBe('0.4.4');
    expect(installed.version).toBe('0.4.4');
    expect(script).toContain("const VERSION = '0.4.4';");
  });

  it('the script stops the install (exit 1) on another version, a moved file or changed blocks, it does not just warn', () => {
    const script = readFileSync(join(__dirname, '../../scripts/patch-sherpa-onnx.mjs'), 'utf8');
    expect(script).toContain('process.exit(1)');
    expect(script).toContain('if (installed !== VERSION)');
    expect(script.match(/\bfail\(/g)).toHaveLength(3); // version, layout, blocks
    expect(script).not.toMatch(/console\.warn\([^)]*(blocks not found|not found, skipped)/);
  });

  it('the download peers of the package are declared, not left to npm to auto-install', () => {
    expect(pkg.dependencies['@kesha-antonov/react-native-background-downloader']).toBeDefined();
    expect(pkg.dependencies['@dr.pogodin/react-native-fs']).toBe('2.40.4');
  });
});
