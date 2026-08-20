// Speaking a card out loud, with the one check expo-speech does not do:
// whether the device actually owns a voice for that language.
//
// FB144, Kálmán 2026-08-19 (hu→en, word:"brother"): "A fiú testvért nem ejti ki
// rendesen". The word ("fiútestvér") and the locale (hu-HU) are both right; the
// phone has no Hungarian voice installed, so Android silently hands the text to
// its default (English) voice and reads Hungarian letters as English ones. A
// wrong-language reading teaches a wrong pronunciation, so the safer answer is
// to stay quiet and let Settings say which voice is missing.
//
// The voice list is loaded once and cached. If the platform returns nothing (or
// throws), every language counts as available, i.e. the app behaves exactly as
// it did before this module.

import * as Speech from 'expo-speech';

let voiceLanguages: Set<string> | null = null;
let loading: Promise<void> | null = null;
const missing = new Set<string>();

// 'hu-HU', 'hu_HU', 'hun' → 'hu'
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split(/[-_]/)[0].slice(0, 2);
}

export async function loadVoices(): Promise<void> {
  if (voiceLanguages || loading) return loading ?? undefined;
  loading = (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      voiceLanguages = new Set((voices ?? []).map(v => baseLanguage(String(v.language ?? ''))));
      // An empty list means "the platform did not tell us", not "no voices".
      if (voiceLanguages.size === 0) voiceLanguages = null;
    } catch {
      voiceLanguages = null;
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

export function speak(text: string, locale: string, options: Speech.SpeechOptions = {}): void {
  if (!text) return;
  if (!hasVoiceFor(locale)) {
    missing.add(baseLanguage(locale));
    return;
  }
  Speech.speak(text, { ...options, language: locale });
}

export function stop(): void {
  Speech.stop();
}

// Tests only: forget the cached voice list.
export function resetVoiceCache(): void {
  voiceLanguages = null;
  loading = null;
  missing.clear();
}
