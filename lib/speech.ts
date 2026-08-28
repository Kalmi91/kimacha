// Speaking a card out loud, with the two things expo-speech does not do:
// pick a voice the device actually owns, and hand Android a language tag it can
// parse.
//
// FB144, Kálmán 2026-08-19 (hu→en, word:"brother"): "A fiú testvért nem ejti ki
// rendesen". The word ("fiútestvér") and the locale ("hu-HU") both looked right,
// so the first fix only skipped speaking when the device listed no Hungarian
// voice. Kálmán asked again on 2026-08-22, and the deeper cause turned up in
// expo-speech's own Android module (56.0.3, SpeechModule.kt `speakOut`):
//
//     textToSpeech.language = options.language?.let {
//       val locale = Locale(it)                       // Locale("hu-HU")!
//       ... isLanguageAvailable(locale) ... else Locale.getDefault()
//
// `Locale("hu-HU")` is not `Locale.forLanguageTag("hu-HU")`: it builds a locale
// whose LANGUAGE is the whole string "hu-hu", and `getISO3Language()` throws for
// it (verified on JDK 17), which Android turns into LANG_NOT_SUPPORTED. So every
// region-qualified tag this app sent was dropped and the engine fell back to
// `Locale.getDefault()`, i.e. Hungarian text read by whatever voice the phone
// defaults to. iOS is unaffected: AVSpeechSynthesisVoice(language:) takes BCP-47.
//
// Hence: Android gets the bare language code, and where the device names a
// concrete voice for that language we pass its identifier too, which bypasses
// the language guess altogether (`setVoice` runs after the locale in speakOut).
//
// The voice list is loaded once and cached. If the platform returns nothing (or
// throws), every language counts as available and no voice is pinned, i.e. the
// app behaves exactly as it did before this module.

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

let voiceLanguages: Set<string> | null = null;
let voicesByLanguage: Map<string, Speech.Voice[]> | null = null;
let loading: Promise<void> | null = null;
const missing = new Set<string>();

// 'hu-HU', 'hu_HU', 'hun' → 'hu'
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split(/[-_]/)[0].slice(0, 2);
}

// 'hu-HU', 'hu_HU' → 'hu-hu'
function normalizeTag(tag: string): string {
  return String(tag ?? '').toLowerCase().replace(/_/g, '-');
}

function isEnhanced(voice: Speech.Voice): boolean {
  return String(voice.quality ?? '').toLowerCase() === 'enhanced';
}

// Enhanced beats default; among equals the engine's own order wins.
function pickBest(voices: Speech.Voice[]): Speech.Voice | undefined {
  return voices.find(isEnhanced) ?? voices[0];
}

export async function loadVoices(): Promise<void> {
  if (voiceLanguages || loading) return loading ?? undefined;
  loading = (async () => {
    try {
      const voices = (await Speech.getAvailableVoicesAsync()) ?? [];
      const languages = new Set<string>();
      const byLanguage = new Map<string, Speech.Voice[]>();
      for (const voice of voices) {
        const lang = baseLanguage(String(voice.language ?? ''));
        if (!lang) continue;
        // A voice with no identifier still proves the language exists, it just
        // cannot be pinned, so it counts for hasVoiceFor and not for voiceIdFor.
        languages.add(lang);
        if (String(voice.identifier ?? '')) {
          byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), voice]);
        }
      }
      // An empty list means "the platform did not tell us", not "no voices".
      voiceLanguages = languages.size > 0 ? languages : null;
      voicesByLanguage = byLanguage.size > 0 ? byLanguage : null;
    } catch {
      voiceLanguages = null;
      voicesByLanguage = null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export function hasVoiceFor(code: string): boolean {
  if (!voiceLanguages) return true; // unknown → behave as before
  return voiceLanguages.has(baseLanguage(code));
}

// Languages a card wanted to speak but the device cannot: Settings turns this
// into "install the Hungarian voice" instead of leaving the learner with a
// silent 🔊 button.
export function missingVoiceLanguages(): string[] {
  return [...missing];
}

// What actually goes to the engine: Android cannot parse "hu-HU" (see above),
// iOS wants the full tag.
export function speechTag(locale: string): string {
  return Platform.OS === 'android' ? baseLanguage(locale) : locale;
}

// The REGION matters as much as the language: a Mexican learner asking for
// es-MX must not be handed the Castilian voice just because it came first in the
// list. Exact region wins, then any voice of the same language.
export function voiceIdFor(locale: string): string | undefined {
  // FB161, Kálmán 2026-08-26 (`word:the grandson`): "megváltoztattad az angol
  // hangot, mintha más lenne? ha véletlenül igen változtasd vissza". The FB144
  // pinning was aimed at Spanish (es-MX, not Castilian) and Hungarian; English
  // only came along for the ride and swapped the familiar system voice for an
  // "enhanced" one. English is therefore left to the engine's own default again;
  // the locale still goes out, so nothing else about FB144 changes.
  if (baseLanguage(locale) === 'en') return undefined;
  const candidates = voicesByLanguage?.get(baseLanguage(locale));
  if (!candidates?.length) return undefined;
  const wanted = normalizeTag(locale);
  const sameRegion = candidates.filter(v => normalizeTag(String(v.language ?? '')) === wanted);
  const voice = pickBest(sameRegion.length ? sameRegion : candidates);
  return voice ? String(voice.identifier) : undefined;
}

// FB152, Kálmán 2026-08-23 (`word:¿Cuándo comes?`): "itt mint ha nem lenne jó a
// kiejtés, az s mintha lemaradna". Android's TTS stops the audio stream on the
// last phoneme boundary, so an utterance that ends in a fricative ("comes",
// "hablas", "tres") gets its final /s/ clipped, the same complaint people file
// against Google TTS itself. Padding the utterance gives the engine something
// to end on, and the padding is silent.
function padForAndroid(text: string): string {
  return Platform.OS === 'android' ? `${text} ` : text;
}

export function speak(text: string, locale: string, options: Speech.SpeechOptions = {}): void {
  if (!text) return;
  if (!hasVoiceFor(locale)) {
    missing.add(baseLanguage(locale));
    return;
  }
  const voice = voiceIdFor(locale);
  Speech.speak(padForAndroid(text), {
    ...options,
    language: speechTag(locale),
    ...(voice ? { voice } : {}),
  });
}

export function stop(): void {
  Speech.stop();
}

// Tests only: forget the cached voice list.
export function resetVoiceCache(): void {
  voiceLanguages = null;
  voicesByLanguage = null;
  loading = null;
  missing.clear();
}
