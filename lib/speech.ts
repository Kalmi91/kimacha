// Speaking a card out loud, with the two things expo-speech does not do:
// pick a voice the device actually owns, and hand Android a language tag it can
// parse.
//
// Reported (hu→en, word:"brother"): the Hungarian word was not pronounced
// properly. The word ("fiútestvér") and the locale ("hu-HU") both looked right,
// so the first fix only skipped speaking when the device listed no Hungarian
// voice. It was reported again on 2026-08-22, and the deeper cause turned up in
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
// app behaves exactly as it did before this module. A slow query also stays unknown.

import { AppState, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { speakNeural, stopNeural } from './neuralTts';
import { neuralEngineFor, neuralFallbackEngine, neuralPackFile, neuralSentenceFile, noteNeuralOk, noteNeuralTrouble, releaseStandIns, startNeural } from './neuralModels';
import { playPackFile, stopPack } from './packAudio';
import { neuralTimeLimitMs, voiceFor, type NeuralEngine, type NeuralLang, type VoiceGender } from './neuralVoices';
import { getFastFallback, onVoiceSettingsChange, preferredGender } from './voicePreference';
import { setSpeechStatus } from './speechStatus';

let voiceLanguages: Set<string> | null = null;
let voicesByLanguage: Map<string, Speech.Voice[]> | null = null;
let loading: Promise<void> | null = null;
// FB633: the phone voice a language first spoke with in this app session stays (undefined = the engine's default),
// so a voice list that arrives late cannot flip it; dropped on a voice setting change and on restart.
const phoneVoiceLock = new Map<string, string | undefined>();
onVoiceSettingsChange(() => phoneVoiceLock.clear());
// True once a voice-list request has finished (found or not): from then on an unknown list is final for the lock.
let voicesSettled = false;
// The voice list was requested at app start (watchAppStateForSpeech): the first speech of a language waits for it.
let startupList = false;
let phoneTimer: ReturnType<typeof setTimeout> | undefined;
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const voices = (await Promise.race([
        Speech.getAvailableVoicesAsync(),
        new Promise<Speech.Voice[]>((resolve) => { timer = setTimeout(() => resolve([]), 2000); }),
      ])) ?? [];
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
      clearTimeout(timer);
      loading = null;
      voicesSettled = true;
    }
  })();
  return loading;
}

function stopPhone(): void {
  clearTimeout(phoneTimer);
  try { void Promise.resolve(Speech.stop()).catch(() => {}); } catch { /* no speech engine */ }
}

// Keep user feedback and callbacks tied to this run, including delayed voice discovery.
function speakOnDevice(text: string, locale: string, options: Speech.SpeechOptions, run: number, reportErrors = true, waited = false): void {
  if (run !== speakingRun) return;
  const fail = (phase: 'noEngine' | 'noVoice' | 'failed', error: Error) => {
    if (run !== speakingRun) return;
    if (!reportErrors) missing.add(baseLanguage(locale));
    setSpeechStatus(run, reportErrors ? phase : 'idle', text);
    if (options.onError) options.onError(error);
    else options.onDone?.(); // release existing read-aloud controls
  };
  if (Platform.OS === 'web' && !globalThis.speechSynthesis) {
    fail('noEngine', new Error('Speech engine unavailable'));
    return;
  }
  // Discovery must not block an engine that can speak but cannot list its voices.
  if (!voiceLanguages && !loading) void loadVoices();
  if (!hasVoiceFor(locale)) {
    missing.add(baseLanguage(locale));
    fail('noVoice', new Error('Speech voice unavailable'));
    return;
  }
  // The first speech of a language waits (up to 1.5 s) for a voice list that is on its way, then locks what it found.
  const lang = normalizeTag(locale);
  if (!phoneVoiceLock.has(lang)) {
    if (voiceLanguages || waited || (voicesSettled && !loading)) {
      phoneVoiceLock.set(lang, voiceIdFor(locale));
    } else if (startupList && loading) {
      let giveUp: ReturnType<typeof setTimeout> | undefined;
      const limit = new Promise<void>(resolve => { giveUp = setTimeout(resolve, 1500); });
      void Promise.race([loading, limit]).then(() => {
        clearTimeout(giveUp);
        speakOnDevice(text, locale, options, run, reportErrors, true);
      });
      return;
    }
  }
  const voice = phoneVoiceLock.has(lang) ? phoneVoiceLock.get(lang) : voiceIdFor(locale);
  let started = false;
  let finished = false;
  const timer = setTimeout(() => {
    if (!started && run === speakingRun) {
      finished = true;
      stopPhone();
      fail(voiceLanguages ? 'failed' : 'noEngine', new Error('Speech did not start'));
    }
  }, 10000);
  phoneTimer = timer;
  const finish = (callback?: () => void) => {
    clearTimeout(timer);
    if (finished || run !== speakingRun) return;
    finished = true;
    setSpeechStatus(run, 'idle');
    callback?.();
  };
  try {
    Speech.speak(padForAndroid(text), {
      ...options,
      language: speechTag(locale),
      ...(voice ? { voice } : {}),
      onStart: () => {
        clearTimeout(timer);
        if (finished || run !== speakingRun) return;
        started = true;
        setSpeechStatus(run, 'playing', text);
        options.onStart?.();
      },
      onDone: () => finish(options.onDone),
      onStopped: () => finish(options.onStopped),
      onError: (error) => { clearTimeout(timer); if (!finished) { finished = true; fail('failed', error); } },
    });
  } catch (error) {
    clearTimeout(timer);
    fail('failed', error instanceof Error ? error : new Error(String(error)));
  }
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
  // Reported (`word:the grandson`): the English voice seemed to have changed
  // ("did you change it? if so, change it back"). The
  // pinning was aimed at Spanish (es-MX, not Castilian), Hungarian and German (de-DE, not de-AT / de-CH); English
  // only came along for the ride and swapped the familiar system voice for an
  // "enhanced" one. English is therefore left to the engine's own default again;
  // the locale still goes out, so nothing else about that fix changes.
  if (baseLanguage(locale) === 'en') return undefined;
  const candidates = voicesByLanguage?.get(baseLanguage(locale));
  if (!candidates?.length) return undefined;
  const wanted = normalizeTag(locale);
  const sameRegion = candidates.filter(v => normalizeTag(String(v.language ?? '')) === wanted);
  const voice = pickBest(sameRegion.length ? sameRegion : candidates);
  return voice ? String(voice.identifier) : undefined;
}

// Reported (`word:¿Cuándo comes?`): the pronunciation seemed off, as if the
// final s were missing. Android's TTS stops the audio stream on the
// last phoneme boundary, so an utterance that ends in a fricative ("comes",
// "hablas", "tres") gets its final /s/ clipped, the same complaint people file
// against Google TTS itself. Padding the utterance gives the engine something
// to end on, and the padding is silent.
function padForAndroid(text: string): string {
  return Platform.OS === 'android' ? `${text} ` : text;
}

// Some agent's test run spoke the words aloud.
// The browser test of the web build (headless Chrome driven over CDP) read everything out
// on the machine's speakers. Nobody listens to a headless browser, so
// speech is silent there; the completion callback still fires, so the screen
// advances as if the audio had played. `navigator.webdriver` does not
// help here: it is `false` in a headless Chrome started via CDP (measured 2026-09-28).
function isHeadlessWeb(): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent;
  return /HeadlessChrome/.test(String(ua ?? ''));
}

// `gender` picks the male / female voice of the better voice (speakerGenderFor gives the one of another text).
export function speak(text: string, locale: string, options: Speech.SpeechOptions & { gender?: VoiceGender; strict?: boolean } = {}, reportErrors = true): void {
  if (!text) return;
  if (isHeadlessWeb()) {
    setTimeout(() => options.onDone?.(), 0);
    return;
  }
  // Reported 2026-11-02: two voices at once. A new speech cuts whatever still sounds on every level, and a
  // word + example chain in flight (speakSequence) stops there too; the phone's own queue (QUEUE_ADD) only
  // kept the phone from talking over itself, not over the word pack or the better voice.
  stop();
  const run = speakingRun;
  setSpeechStatus(run, 'loading', text);
  const { gender, strict, ...phoneOptions } = options;
  cancelSpeech = () => options.onStopped?.();
  let finished = false;
  const finish = (callback?: () => void) => {
    if (finished || run !== speakingRun) return;
    finished = true;
    cancelSpeech = null;
    setSpeechStatus(run, 'idle');
    callback?.();
  };
  const viaPhone = () => speakOnDevice(text, locale, {
    ...phoneOptions,
    onDone: () => finish(options.onDone),
    onStopped: () => finish(options.onStopped),
    onError: (error) => {
      if (finished || run !== speakingRun) return;
      finished = true;
      cancelSpeech = null;
      options.onError?.(error);
      if (!reportErrors || !options.onError) options.onDone?.();
    },
  }, run, reportErrors);
  if (speakBetter(text, locale, {
    rate: options.rate, gender, strict,
    onDone: () => finish(options.onDone),
    onStopped: () => finish(options.onStopped),
  }, viaPhone)) return;
  viaPhone();
}

// FB543: the sex of the voice that speaks `text` (the word pack and both engines pick it the same way), so a
// learner's tap on the example sentence's own speaker keeps the word's speaker. Undefined for a language the
// better voice does not cover. The person chosen in Settings -> Voice speaks it when there is one.
export function speakerGenderFor(text: string, locale: string): VoiceGender | undefined {
  const lang = neuralLangFor(locale);
  return lang ? preferredGender(lang) ?? voiceFor(lang, 'kokoro', text).gender : undefined;
}

// The person chosen in Settings -> Voice for the locale's language (f / m); undefined = Automatic or a language
// the better voice does not cover.
export function preferredGenderFor(locale: string): 'f' | 'm' | undefined {
  const lang = neuralLangFor(locale);
  return lang ? preferredGender(lang) : undefined;
}

function neuralLangFor(locale: string): NeuralLang | null {
  const base = baseLanguage(locale);
  return base === 'es' || base === 'en' || base === 'hu' || base === 'de' ? base : null;
}

// The better voice (Settings, lib/neuralModels.ts) is tried before the phone's own, on four levels:
// (1) the word pack's recording of a card word, (1b) the sentence pack's recording of a fixed sentence by the
// speaker of the call's gender, (2) the language's sentence engine (Piper or Kokoro, the
// text spoken by the voice lib/neuralVoices.ts picks), (3) the phone. A level that is not ready is
// skipped, and one that fails (a broken file, an engine error) hands the same text to the next, so the
// learner never gets silence for a text the phone could have read. Returns false when neither of the
// first two is ready: nothing was started, the caller speaks with the phone. The speech in flight is cut
// first, like the next phone speech cuts it; onDone / onStopped mean what they mean for the phone.
interface BetterOptions {
  rate?: number;
  gender?: VoiceGender;
  /** A line whose speaker must never be swapped for the other sex (the practice exam's dialogue): no fast fallback. */
  strict?: boolean;
  onDone?: () => void;
  onStopped?: () => void;
}

function speakBetter(text: string, locale: string, opts: BetterOptions, phone: () => void): boolean {
  const lang = neuralLangFor(locale);
  if (!lang) return false;
  // A male / female line (practice exam) keeps its sex; any other speech takes the person chosen in Settings -> Voice.
  // Either way the speech must not get a pack recording of the other sex.
  const explicitSex = opts.gender === 'f' || opts.gender === 'm';
  const picked = preferredGender(lang);
  const gender = explicitSex ? opts.gender : picked ?? opts.gender;
  // v2 of the word pack has both people of the pair: the recording of the speaking sex, none of the other.
  const wordFile = neuralPackFile(lang, text, gender);
  // The sentence pack (Audio round B) after the word pack: the speaker is the explicit gender (a sequence's shared
  // speaker, a card's word), else the text's own hash gender, the one the engine would pick.
  let pack = wordFile ?? neuralSentenceFile(lang, text, gender);
  // Temporary until EJSZAKA E101 (both voices recorded), Kálmán 2026-11-03: the picked person has no recording of
  // this text, so with the "Fast fallback" switch on the existing recording of the other person plays at once
  // (the word's own voice, else the sentence pack's other speaker) instead of a slower generated one. It applies
  // when the speaking gender is the picked person (handed in explicitly by withSharedSpeaker / wordSpeakerGender
  // or not); a different explicit sex and a strict line (the practice exam's dialogue) never take the other sex.
  if (!pack && picked && gender === picked && !opts.strict && getFastFallback()) {
    pack = neuralPackFile(lang, text) ?? neuralSentenceFile(lang, text, picked === 'f' ? 'm' : 'f') ?? neuralSentenceFile(lang, text);
  }
  const engine = neuralEngineFor(lang);
  if (!pack && !engine) return false;
  stopPhone();
  stopNeural();
  stopPack();
  // The phone takes over from a level that failed: whatever of that level still sounds is cut first.
  const toPhone = () => {
    if (run !== speakingRun) return;
    stopNeural();
    stopPack();
    phone();
  };
  const run = speakingRun;
  setSpeechStatus(run, 'playing', text);
  // Level 2 and 2b: the chosen engine, then the other one if it is loaded. An engine that fails or gives no audio
  // within its time limit (FB608/609: a slow Kokoro left silence) hands the same text on, the phone last.
  const attempt = (engine: NeuralEngine, canHandOver: boolean) => {
    if (run !== speakingRun) return;
    speakNeural(text, lang, voiceFor(lang, engine, text, gender), {
      rate: opts.rate,
      onDone: opts.onDone,
      onStopped: opts.onStopped,
      firstChunkTimeoutMs: neuralTimeLimitMs(engine, text),
    }).then(
      timings => {
        if (timings.firstChunkMs >= 0) noteNeuralOk(lang, engine);
      },
      err => {
        if (run !== speakingRun) return;
        // the learner's own cut generation still running is not the engine's fault: hand over, report nothing
        const name = err instanceof Error ? err.name : '';
        if (name !== 'NeuralBusyError') noteNeuralTrouble(lang, engine, name === 'NeuralSlowError' ? 'slow' : 'failed');
        const next = canHandOver ? neuralFallbackEngine(lang, engine) : null;
        if (next) attempt(next, false);
        else toPhone();
      },
    );
  };
  const viaEngine = () => {
    if (run !== speakingRun) return;
    const now = neuralEngineFor(lang);
    if (!now) {
      toPhone();
      return;
    }
    attempt(now, true);
  };
  if (pack) {
    playPackFile(pack, { rate: opts.rate, onDone: opts.onDone, onStopped: opts.onStopped, onFail: viaEngine });
  } else {
    viaEngine();
  }
  return true;
}

export function stop(): void {
  const cancel = cancelSpeech;
  cancelSpeech = null;
  speakingRun += 1; // no running segment chain may continue after the stop
  cancel?.();
  setSpeechStatus(speakingRun, 'idle');
  stopPhone();
  stopNeural();
  stopPack();
}

// Opening the app must not talk (Kálmán, 2026-11-02). An automatic read-aloud (a new card's prompt, a new
// sentence card, word and sentence alike) stays silent from the start, and from every return out of the
// background, until the learner first touches the screen (the root layout reports each touch). Whatever the
// learner asks for (a speaker button, a Check) goes through speak() and always sounds.
let quietStart = true;

export function speakAuto(text: string, locale: string, options: Speech.SpeechOptions & { gender?: VoiceGender; strict?: boolean } = {}): void {
  if (quietStart) return;
  speak(text, locale, options, false);
}

export function noteSpeechTouch(): void {
  quietStart = false;
}

// The lesson screen's stop button calls this (the same button
// that started the speech, play → stop). It differs from `stop()` only in the
// name; on the screen side it is more readable what the button press does.
export function stopSpeaking(): void {
  stop();
}

// Reported (word:the fish): after switching in and out of the app a lot,
// the app lost its sound. The Android TTS engine can get stuck on a half-finished utterance
// sent to the background, and stay silent afterwards. Therefore on every app state
// change (to the background / back to the foreground) we stop the engine:
// it cannot keep speaking in the background anyway, and in the foreground the
// next speak() starts with a clean slate. The root layout wires it up, following the usageTimer pattern.
let appStateSub: { remove(): void } | null = null;
let memorySub: { remove(): void } | null = null;

export function watchAppStateForSpeech(): () => void {
  // FB633: the phone's voice list is asked for at start, not by the first speech: a speech that comes before the list is
  // known gets the engine's default voice, the next one the pinned voice (a different voice on the same card).
  startupList = true;
  void loadVoices();
  void startNeural(); // reads the better voice's settings and loads its engines (once per run)
  memorySub?.remove();
  memorySub = AppState.addEventListener('memoryWarning', () => void releaseStandIns());
  appStateSub?.remove();
  appStateSub = AppState.addEventListener('change', state => {
    stop();
    if (state === 'background') quietStart = true;
  });
  return () => {
    appStateSub?.remove();
    appStateSub = null;
    memorySub?.remove();
    memorySub = null;
  };
}

// Mixed-language text is spoken with a different voice per segment (lib/mixedSpeech.ts
// splits it up). The segments run one AFTER another: the next starts in the `onDone` of each utterance,
// because the voices of two languages started in parallel would talk over each other.
// A new speech (or a `stop()`) invalidates the previous chain.
let speakingRun = 0;
let cancelSpeech: (() => void) | null = null;

export interface SpeechRunSegment {
  text: string;
  locale: string;
  /** Voice pitch of the segment (1 = the engine's own); the practice exam gives each speaker a different one. */
  pitch?: number;
  /** m / f picks the male / female voice of the better voice; n or nothing leaves it to the text. */
  gender?: VoiceGender;
  /** The practice exam's dialogue speakers: never swapped for the other sex when the picked person has no recording. */
  strict?: boolean;
}

// FB543: one speaker per language in a sequence. A segment without a gender of its own gets the sex of the
// voice that speaks the first segment of its language, so a word and its example sentence do not change
// voice (the Kokoro and Piper pairs are both ordered f, m: the engine that is ready does not change the
// speaker). An explicit gender (the practice exam's speakers) stays.
function withSharedSpeaker(segments: SpeechRunSegment[]): SpeechRunSegment[] {
  const first = new Map<NeuralLang, 'f' | 'm'>();
  return segments.map((seg) => {
    const lang = neuralLangFor(seg.locale);
    if (!lang) return seg;
    const chosen = preferredGender(lang);
    const fixed = seg.gender === 'f' || seg.gender === 'm';
    let gender = first.get(lang);
    if (!gender) {
      gender = voiceFor(lang, 'kokoro', seg.text, fixed ? seg.gender : chosen).gender;
      first.set(lang, gender);
    }
    // the person chosen in Settings -> Voice also takes the segments of no sex (the exam's narrator, 'n')
    return fixed || (seg.gender && !chosen) ? seg : { ...seg, gender };
  });
}

// `onStopped` fires when a segment in flight is cut off by a stop() or by the next speech (not at the natural end).
export function speakSequence(segments: SpeechRunSegment[], onEnd?: () => void, onStopped?: () => void, onError?: () => void): void {
  stop();
  const run = speakingRun;
  cancelSpeech = () => onStopped?.();
  const queue = withSharedSpeaker(segments.filter((seg) => seg.text.trim()));

  const next = (index: number) => {
    if (run !== speakingRun) return; // another speech started in the meantime
    const segment = queue[index];
    if (!segment) {
      cancelSpeech = null;
      setSpeechStatus(run, 'idle');
      onEnd?.();
      return;
    }
    setSpeechStatus(run, 'loading', segment.text);
    let ended = false;
    const done = () => {
      if (ended || run !== speakingRun) return;
      ended = true;
      next(index + 1);
    };
    const stopped = () => {
      if (ended || run !== speakingRun) return;
      ended = true;
      cancelSpeech = null;
      setSpeechStatus(run, 'idle');
      onStopped?.();
    };
    const viaPhone = () => {
      speakOnDevice(segment.text, segment.locale, {
        ...(segment.pitch !== undefined ? { pitch: segment.pitch } : {}),
        onDone: done,
        onStopped: stopped,
        onError: () => {
          if (onError) { ended = true; cancelSpeech = null; onError(); }
          else {
            // No voice for this language: the segment is skipped, the rest carry on
            // (Settings offers the installation based on missingVoiceLanguages(),
            // the same way as for the single-language speak()). Runtime failures also skip.
            done();
          }
        },
      }, run);
    };
    const better = { gender: segment.gender, strict: segment.strict, onDone: done, onStopped: stopped };
    if (!speakBetter(segment.text, segment.locale, better, viaPhone)) viaPhone();
  };

  if (isHeadlessWeb()) {
    setTimeout(() => { if (run === speakingRun) { cancelSpeech = null; onEnd?.(); } }, 0);
    return;
  }
  next(0);
}


// Tests only: forget the cached voice list.
export function resetVoiceCache(): void {
  clearTimeout(phoneTimer);
  cancelSpeech = null;
  voiceLanguages = null;
  voicesByLanguage = null;
  loading = null;
  voicesSettled = false;
  startupList = false;
  phoneVoiceLock.clear();
  missing.clear();
  speakingRun += 1;
  setSpeechStatus(speakingRun, 'idle');
  quietStart = true;
}
