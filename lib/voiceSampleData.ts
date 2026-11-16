// Voice samples of Settings -> Voice (EJSZAKA E109): one short sentence per (language, engine, person), recorded
// ahead (scripts/voice-samples.py) and shipped in assets/voice-samples/, so a voice can be heard before any model is
// downloaded. Pure data (no native imports): lib/voiceSample.ts plays it, lib/voiceSample.web.ts is silent.

import { isPiperOnly, type NeuralEngine, type NeuralLang } from './neuralVoices';

export const SAMPLE_SENTENCES: Record<NeuralLang, string> = {
  es: 'Hoy quiero aprender palabras nuevas.',
  en: 'Today I want to learn new words.',
  hu: 'Ma új szavakat szeretnék tanulni.',
  de: 'Heute möchte ich neue Wörter lernen.',
};

export type SampleGender = 'f' | 'm';
export const SAMPLE_GENDERS: readonly SampleGender[] = ['f', 'm'];
const LANGS: readonly NeuralLang[] = ['es', 'en', 'hu', 'de'];

// "<lang>-<engine>-<f|m>", also the file name without .mp3. Hungarian and German have no Kokoro voice.
export type SampleKey = `${NeuralLang}-${NeuralEngine}-${SampleGender}`;

export function sampleKey(lang: NeuralLang, engine: NeuralEngine, gender: SampleGender): SampleKey {
  return `${lang}-${engine}-${gender}`;
}

export function hasSample(lang: NeuralLang, engine: NeuralEngine, gender: SampleGender): boolean {
  return engine === 'piper' || !isPiperOnly(lang) ? SAMPLE_GENDERS.includes(gender) : false;
}

export const SAMPLE_KEYS: SampleKey[] = LANGS.flatMap(lang =>
  (['piper', 'kokoro'] as NeuralEngine[]).flatMap(engine =>
    SAMPLE_GENDERS.filter(gender => hasSample(lang, engine, gender)).map(gender => sampleKey(lang, engine, gender)),
  ),
);
