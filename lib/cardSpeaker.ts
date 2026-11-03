// Audio round B: the speaker of a deck card's sentences. A sentence card (TypedSentenceCard, EasySentenceCard)
// and the reading practice speak a card's example sentence, in either language, with the voice of the card's
// WORD: the sex of the word-pack voice of the answer field's full text, so the word and its sentences share one
// speaker and the sentence pack finds its recording (scripts/tts-pack.py sentence-tab / reading rules). Only es
// and en have the packs; any other target keeps the text's own voice (undefined).

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { voiceFor, type VoiceGender } from '@/lib/neuralVoices';
import { wordIn } from '@/lib/pcicItemText';

export function wordSpeakerGender(item: PcicItem | undefined, target: PcicTarget): VoiceGender | undefined {
  const word = item ? wordIn(item, target) : undefined;
  if (!word || (target !== 'es' && target !== 'en')) return undefined;
  return voiceFor(target, 'kokoro', word).gender;
}
