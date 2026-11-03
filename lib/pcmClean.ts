// FB544/545: cleans one chunk of on-device Piper speech. The Piper voices carry a steady hiss (about -52 dBFS)
// that is only heard in the pauses, and an utterance that starts or ends on a non-zero sample clicks. A pure
// function over the samples, so jest can measure it: lib/neuralTts.ts applies it to the Piper chunks.
//
// - noise gate: 10 ms windows; a window below GATE_BELOW_DB that is farther than GATE_GUARD_MS from every
//   window above SPEECH_ABOVE_DB is muted, with linear ramps at the gate edges (a hard step would click);
// - a short fade-in at the start and a longer fade-out at the end of the utterance;
// - nothing else: no EQ, no normalization.

const WINDOW_MS = 10;
const GATE_BELOW_DB = -46;
const SPEECH_ABOVE_DB = -40;
const GATE_GUARD_MS = 40;
const RAMP_MS = 5;
const FADE_IN_MS = 8;
const FADE_OUT_MS = 15;

const msToSamples = (ms: number, sampleRate: number) => Math.max(1, Math.round((ms / 1000) * sampleRate));

export function cleanPcm(samples: Float32Array, sampleRate: number): Float32Array {
  const out = Float32Array.from(samples);
  const len = out.length;
  if (len === 0) return out;

  const win = msToSamples(WINDOW_MS, sampleRate);
  const windows = Math.ceil(len / win);
  const db = new Array<number>(windows);
  for (let w = 0; w < windows; w += 1) {
    const from = w * win;
    const to = Math.min(len, from + win);
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += samples[i] * samples[i];
    db[w] = 20 * Math.log10(Math.sqrt(sum / (to - from)));
  }

  // a gap in samples between two windows is (distance in windows - 1) * win; no speech window at all means
  // the whole chunk is quiet, which is not a pause, so then only the fades apply
  const guard = msToSamples(GATE_GUARD_MS, sampleRate);
  const loud: number[] = [];
  for (let w = 0; w < windows; w += 1) if (db[w] > SPEECH_ABOVE_DB) loud.push(w);
  if (loud.length > 0) {
    const gated = new Array<boolean>(windows);
    let next = 0; // index in `loud` of the first speech window at or after w
    for (let w = 0; w < windows; w += 1) {
      while (next < loud.length && loud[next] < w) next += 1;
      const after = next < loud.length ? loud[next] : Infinity;
      const before = next > 0 ? loud[next - 1] : -Infinity;
      const gap = (Math.min(w - before, after - w) - 1) * win;
      gated[w] = db[w] < GATE_BELOW_DB && gap > guard;
    }
    const ramp = msToSamples(RAMP_MS, sampleRate);
    let w = 0;
    while (w < windows) {
      if (!gated[w]) {
        w += 1;
        continue;
      }
      let end = w;
      while (end < windows && gated[end]) end += 1;
      const a = w * win;
      const b = Math.min(len, end * win);
      for (let i = a; i < b; i += 1) {
        out[i] *= Math.max(0, 1 - (i - a) / ramp, 1 - (b - i) / ramp);
      }
      w = end;
    }
  }

  const fadeIn = Math.min(len, msToSamples(FADE_IN_MS, sampleRate));
  for (let i = 0; i < fadeIn; i += 1) out[i] *= i / fadeIn;
  const fadeOut = Math.min(len, msToSamples(FADE_OUT_MS, sampleRate));
  for (let i = 0; i < fadeOut; i += 1) out[len - 1 - i] *= i / fadeOut;
  return out;
}
