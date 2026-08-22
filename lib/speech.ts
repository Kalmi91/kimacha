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
let voiceByLanguage: Map<string, string> | null = null;
let loading: Promise<void> | null = null;
const missing = new Set<string>();

// 'hu-HU', 'hu_HU', 'hun' → 'hu'
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split(/[-_]/)[0].slice(0, 2);
}

// An enhanced voice beats a default one; among equals the first wins, which is
// the order the engine itself reports.
function betterVoice(a: Speech.Voice, b: Speech.Voice): Speech.Voice {
  const enhanced = (v: Speech.Voice) => String(v.quality ?? '').toLowerCase() === 'enhanced';
  return enhanced(b) && !enhanced(a) ? b : a;
}

export async function loadVoices(): Promise<void> {
  if (voiceLanguages || loading) return loading ?? undefined;
  loading = (async () => {
    try {
      const voices = (await Speech.getAvailableVoicesAsync()) ?? [];
      const languages = new Set<string>();
      const best = new Map<string, Speech.Voice>();
      for (const voice of voices) {
        const lang = baseLanguage(String(voice.language ?? ''));
        if (!lang) continue;
        languages.add(lang);
        const current = best.get(lang);
        best.set(lang, current ? betterVoice(current, voice) : voice);
      }
      // An empty list means "the platform did not tell us", not "no voices".
      voiceLanguages = languages.size > 0 ? languages : null;
      const ids = new Map<string, string>();
      for (const [lang, voice] of best) {
        const id = String(voice.identifier ?? '');
        if (id) ids.set(lang, id);
      }
      voiceByLanguage = ids.size > 0 ? ids : null;
    } catch {
      voiceLanguages = null;
      voiceByLanguage = null;
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

export function voiceIdFor(locale: string): string | undefined {
  return voiceByLanguage?.get(baseLanguage(locale));
}

export function speak(text: string, locale: string, options: Speech.SpeechOptions = {}): void {
  if (!text) return;
  if (!hasVoiceFor(locale)) {
    missing.add(baseLanguage(locale));
    return;
  }
  const voice = voiceIdFor(locale);
  Speech.speak(text, {
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
  voiceByLanguage = null;
  loading = null;
  missing.clear();
}
