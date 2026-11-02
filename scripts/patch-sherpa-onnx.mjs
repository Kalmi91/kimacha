// react-native-sherpa-onnx 0.4.4 builds the Kokoro config without a `lang` (SherpaOnnxTtsHelper.kt), so
// the multi-language Kokoro model (kokoro-int8-multi-lang-v1_0) phonemizes everything with the voice the
// model's own metadata names, "en-us": a Spanish sentence is read with English phonemes ("Mañana" →
// "mænjˈɑːnə", measured on the kimacha_smoke emulator, 2026-11-01).
// The JS API has no field for it and the TurboModule spec is fixed, so the language rides on the
// `modelType` string that JS passes through unchanged: "kokoro@es-419" = model type "kokoro" + the
// espeak-ng language tag (lib/neuralTts.ts builds it). A bare "kokoro" keeps the model's own default.
// For a language other than English the lexicon is left out too: the bundled lexicon is English (and
// Chinese), and a Spanish word that is also an English word ("no", "me", "son", "sin") would otherwise be
// read as English; without it every word goes through espeak-ng with the given tag.
// Only the initial init is patched; updateTtsParams (not used by the app) would drop the language again.
// Runs as postinstall (npm ci in CI and in the release worktree), after patch-expo-speech.mjs.
// lib/__tests__/sherpaOnnxPatch.test.ts fails when the file is not patched (e.g. a package update changed
// it: check whether the language is passed upstream by then and drop this script).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(
  new URL('../node_modules/react-native-sherpa-onnx/android/src/main/java/com/sherpaonnx/SherpaOnnxTtsHelper.kt', import.meta.url),
);

const MARK = 'kimacha: kokoro language';

// [what to find, what to put there]: every `before` must be present exactly as written.
const edits = [
  [
    `      val result = detectTtsModel(modelDir, modelType)
      if (result == null) {
        Log.e("SherpaOnnxTts", "TTS_INIT_ERROR: Failed to detect TTS model: native call returned null")`,
    `      // ${MARK}: "kokoro@es-419" = model type + espeak-ng language tag
      val modelTypeAndLang = modelType.split("@", limit = 2)
      val modelType = modelTypeAndLang[0]
      val kokoroLang = modelTypeAndLang.getOrElse(1) { "" }
      val result = detectTtsModel(modelDir, modelType)
      if (result == null) {
        Log.e("SherpaOnnxTts", "TTS_INIT_ERROR: Failed to detect TTS model: native call returned null")`,
  ],
  [
    `          paths, modelTypeStr, numThreads.toInt(), debug,
          noiseScale, noiseScaleW, lengthScale,
          ruleFsts, ruleFars, maxNumSentences?.toInt(), silenceScale,
          provider
        )
        inst.tts = OfflineTts(config = config)`,
    `          paths, modelTypeStr, numThreads.toInt(), debug,
          noiseScale, noiseScaleW, lengthScale,
          ruleFsts, ruleFars, maxNumSentences?.toInt(), silenceScale,
          provider, kokoroLang
        )
        inst.tts = OfflineTts(config = config)`,
  ],
  [
    `    silenceScale: Double?,
    provider: String?
  ): OfflineTtsConfig {`,
    `    silenceScale: Double?,
    provider: String?,
    kokoroLang: String = ""
  ): OfflineTtsConfig {`,
  ],
];

// Both Kokoro configs (explicit "kokoro" and the auto-detected one) end with the lexicon and the length scale.
const kokoroLexicon = /lexicon = path\(paths, "lexicon"\),(\n\s+)lengthScale = ls/g;
const kokoroLexiconPatched = (_match, gap) =>
  `lexicon = if (kokoroLang.isEmpty() || kokoroLang.startsWith("en")) path(paths, "lexicon") else "",${gap}lang = kokoroLang,${gap}lengthScale = ls`;

if (!existsSync(file)) {
  console.warn(`patch-sherpa-onnx: ${file} not found, skipped`);
} else {
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (source.includes(MARK)) {
    console.log('patch-sherpa-onnx: already patched');
  } else if (edits.every(([before]) => source.includes(before)) && source.match(kokoroLexicon)?.length === 2) {
    let patched = source;
    for (const [before, after] of edits) patched = patched.replace(before, after);
    patched = patched.replace(kokoroLexicon, kokoroLexiconPatched);
    writeFileSync(file, patched);
    console.log('patch-sherpa-onnx: Kokoro now gets its language from the modelType suffix ("kokoro@es-419")');
  } else {
    console.warn('patch-sherpa-onnx: expected blocks not found, react-native-sherpa-onnx changed (see lib/__tests__/sherpaOnnxPatch.test.ts)');
  }
}
