// Voices, models and the word-pack key of the neural speech layer (no native imports: the web build
// and the jest tests use it as it is). The engine itself is lib/neuralTts.ts, the downloads are
// lib/neuralModels.ts. scripts/tts-pack.py (the word pack) follows the same contract: the same key, the
// same hash, the same voice order.
//
// Contract (PLAN-tts-1101): the word pack file of a card word is picked by
//   key  = text.trim().normalize('NFC')        (case and article stay: "el perro")
//   hash = FNV-1a 32 bit over the UTF-8 bytes of the key, 8 lowercase hex digits
//   voice = hash is even → voice 0, odd → voice 1 (of the language's pair below)
// The sentence engines (Piper / Kokoro) pick their voice with the same rule, so a word sounds the
// same whichever of the three levels (pack, engine, phone) happens to speak it.

export type NeuralLang = 'es' | 'en' | 'hu';
export type NeuralEngine = 'piper' | 'kokoro';
export type VoiceGender = 'f' | 'm' | 'n';

export interface NeuralVoice {
  id: string;
  engine: NeuralEngine;
  /** Key of the model that holds the voice (NEURAL_MODELS). */
  model: string;
  /** Speaker id inside the model (Piper models have one speaker: 0). */
  sid: number;
  gender: 'f' | 'm';
}

// Kokoro speaker ids come from the model's own ONNX metadata (`speaker2id` of
// kokoro-int8-multi-lang-v1_0/model.int8.onnx, 54 voices, 24 kHz):
//   af_heart=3  am_michael=16  ef_dora=28  em_alex=29
export const KOKORO_VOICES: Record<'es' | 'en', [NeuralVoice, NeuralVoice]> = {
  es: [
    { id: 'ef_dora', engine: 'kokoro', model: 'kokoro', sid: 28, gender: 'f' },
    { id: 'em_alex', engine: 'kokoro', model: 'kokoro', sid: 29, gender: 'm' },
  ],
  en: [
    { id: 'af_heart', engine: 'kokoro', model: 'kokoro', sid: 3, gender: 'f' },
    { id: 'am_michael', engine: 'kokoro', model: 'kokoro', sid: 16, gender: 'm' },
  ],
};

// Piper (VITS) models have one speaker each, so a pair is two models. en kristin and john are public
// domain, hu berta and imre are CC0. The gender of the two es_MX voices is not documented anywhere the
// model ships; it was measured on the emulator (fundamental frequency of the generated speech), see
// the PLAN-tts-1101 log.
export const PIPER_VOICES: Record<NeuralLang, [NeuralVoice, NeuralVoice]> = {
  es: [
    { id: 'es_MX-claude-high', engine: 'piper', model: 'es_MX-claude-high', sid: 0, gender: 'f' },
    { id: 'es_MX-ald-medium', engine: 'piper', model: 'es_MX-ald-medium', sid: 0, gender: 'm' },
  ],
  en: [
    { id: 'en_US-kristin-medium', engine: 'piper', model: 'en_US-kristin-medium', sid: 0, gender: 'f' },
    { id: 'en_US-john-medium', engine: 'piper', model: 'en_US-john-medium', sid: 0, gender: 'm' },
  ],
  hu: [
    { id: 'hu_HU-berta-medium', engine: 'piper', model: 'hu_HU-berta-medium', sid: 0, gender: 'f' },
    { id: 'hu_HU-imre-medium', engine: 'piper', model: 'hu_HU-imre-medium', sid: 0, gender: 'm' },
  ],
};

export interface NeuralModel {
  key: string;
  engine: NeuralEngine;
  /** Folder the archive extracts into, under <files>/tts. */
  dir: string;
  archive: string;
  bytes: number;
}

const RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';
const piper = (key: string, bytes: number): NeuralModel => ({
  key,
  engine: 'piper',
  dir: `vits-piper-${key}-int8`,
  archive: `${RELEASE}/vits-piper-${key}-int8.tar.bz2`,
  bytes,
});

export const NEURAL_MODELS: Record<string, NeuralModel> = {
  kokoro: {
    key: 'kokoro',
    engine: 'kokoro',
    dir: 'kokoro-int8-multi-lang-v1_0',
    archive: `${RELEASE}/kokoro-int8-multi-lang-v1_0.tar.bz2`,
    bytes: 132353410,
  },
  'es_MX-claude-high': piper('es_MX-claude-high', 21216685),
  'es_MX-ald-medium': piper('es_MX-ald-medium', 21283187),
  'en_US-kristin-medium': piper('en_US-kristin-medium', 20882061),
  'en_US-john-medium': piper('en_US-john-medium', 20800096),
  'hu_HU-berta-medium': piper('hu_HU-berta-medium', 21072384),
  'hu_HU-imre-medium': piper('hu_HU-imre-medium', 21202370),
};

export const PIPER_MODEL_KEYS: string[] = Object.values(NEURAL_MODELS)
  .filter(m => m.engine === 'piper')
  .map(m => m.key);

// The word pack (scripts/tts-pack.py): a GitHub release asset of the app's own repo (tts-pack-v1, 119 608 678
// bytes as uploaded). The Settings label and the progress count it with the models.
export const PACK_KEY = 'pack';
export const PACK_BYTES = 119608678;
export const PACK_URL = 'https://github.com/Kalmi91/kimacha/releases/download/tts-pack-v1/kimacha-tts-pack-v1.tar.bz2';
export const PACK_DIR = 'kimacha-tts-pack-v1';

// espeak-ng voice the Kokoro engine speaks each language with. es-419 is Latin-American Spanish and is
// in the espeak-ng data of the Kokoro archive (espeak-ng-data/lang/roa/es-419, checked 2026-11-02).
export const KOKORO_LANG_TAG: Record<'es' | 'en', string> = { es: 'es-419', en: 'en-us' };

export type EngineChoice = Record<NeuralLang, NeuralEngine>;
// Piper is the default (fast); Hungarian has no Kokoro voice, so it is always Piper.
export const DEFAULT_ENGINES: EngineChoice = { es: 'piper', en: 'piper', hu: 'piper' };

export function normalizeEngines(raw: Partial<Record<NeuralLang, NeuralEngine>> | null | undefined): EngineChoice {
  return {
    es: raw?.es === 'kokoro' ? 'kokoro' : 'piper',
    en: raw?.en === 'kokoro' ? 'kokoro' : 'piper',
    hu: 'piper',
  };
}

export function packKey(text: string): string {
  const trimmed = text.trim();
  return typeof trimmed.normalize === 'function' ? trimmed.normalize('NFC') : trimmed;
}

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

// FNV-1a, 32 bit: offset 0x811c9dc5, prime 0x01000193.
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function packHash(text: string): string {
  return fnv1a(packKey(text)).toString(16).padStart(8, '0');
}

// 0 or 1: which voice of the language's pair speaks the text. `gender` (the practice exam's speakers:
// f / m) overrides the hash; 'n' or nothing keeps the hash.
export function voiceIndexFor(lang: NeuralLang, engine: NeuralEngine, text: string, gender?: VoiceGender): 0 | 1 {
  const pair = voicePair(lang, engine);
  if (gender === 'f' || gender === 'm') return pair[0].gender === gender ? 0 : 1;
  return fnv1a(packKey(text)) % 2 === 0 ? 0 : 1;
}

export function voicePair(lang: NeuralLang, engine: NeuralEngine): [NeuralVoice, NeuralVoice] {
  if (engine === 'kokoro' && lang !== 'hu') return KOKORO_VOICES[lang];
  return PIPER_VOICES[lang];
}

export function voiceFor(lang: NeuralLang, engine: NeuralEngine, text: string, gender?: VoiceGender): NeuralVoice {
  return voicePair(lang, engine)[voiceIndexFor(lang, engine, text, gender)];
}

// The models a language needs when it speaks with `engine`.
export function modelKeysFor(lang: NeuralLang, engine: NeuralEngine): string[] {
  return [...new Set(voicePair(lang, engine).map(v => v.model))];
}

// What the better voice needs on the phone: the word pack, the six Piper models (the default engine, and
// Hungarian's only one), and the Kokoro model when a language chose Kokoro.
export function requiredItems(engines: EngineChoice): string[] {
  const kokoro = engines.es === 'kokoro' || engines.en === 'kokoro';
  return [PACK_KEY, ...PIPER_MODEL_KEYS, ...(kokoro ? ['kokoro'] : [])];
}

// Bytes still to fetch for the items that are not installed yet (the pack included).
export function missingBytes(items: string[], installed: Record<string, boolean>): number {
  return items.filter(key => !installed[key]).reduce((sum, key) => sum + (key === PACK_KEY ? PACK_BYTES : NEURAL_MODELS[key]?.bytes ?? 0), 0);
}

// The shape of the pack's index.json.
export interface PackIndex {
  version: number;
  engine: string;
  files: Partial<Record<'es' | 'en', Record<string, string>>>;
}

// Relative path of the pack's audio file for the text, or null (the pack covers es and en card words).
export function packFileFor(index: PackIndex | null, lang: NeuralLang, text: string): string | null {
  if (!index || lang === 'hu') return null;
  return index.files[lang]?.[packKey(text)] ?? null;
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1048576)} MB`;
}
