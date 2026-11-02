// The recordings of the authored B1-C1 tasks: lines with a speaker, spoken one after another with TTS.
// The speaker changes the pitch of the phone's voice (the device has one voice per language); the better
// voice (lib/neuralVoices.ts) has a male and a female one per language and takes the sex from `gender`.

import type { SpeechRunSegment } from '@/lib/speech';
import type { MockAudioLine } from './types';

/** Voice pitch per speaker: m = deep, f = high, n (and a line without a speaker) = neutral. */
export const SPEAKER_PITCH = { m: 0.85, f: 1.15, n: 1.0 } as const;

/** The lines as speech segments in the target language, each with its speaker's pitch and sex. */
export function audioSegments(lines: MockAudioLine[], locale: string): SpeechRunSegment[] {
  return lines.map((line) => ({ text: line.text, locale, pitch: SPEAKER_PITCH[line.speaker ?? 'n'], gender: line.speaker ?? 'n' }));
}

/** The transcript for a device without a voice: the lines, led by A / B when exactly two speakers talk. */
export function audioTranscript(lines: MockAudioLine[], labels: [a: string, b: string]): string {
  const speakers = [...new Set(lines.map((l) => l.speaker ?? 'n'))];
  const named = speakers.length === 2;
  return lines.map((l) => (named ? `${labels[speakers.indexOf(l.speaker ?? 'n')]}: ${l.text}` : l.text)).join('\n');
}
