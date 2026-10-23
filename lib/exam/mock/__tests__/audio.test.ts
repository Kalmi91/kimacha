// The recordings of the authored tasks: the pitch per speaker lives in one constant, the lines become speech segments.

import { audioSegments, audioTranscript, SPEAKER_PITCH } from '../audio';

describe('audio lines', () => {
  it('the pitch per speaker: m deep, f high, n and no speaker neutral', () => {
    expect(SPEAKER_PITCH).toEqual({ m: 0.85, f: 1.15, n: 1.0 });
    const segments = audioSegments([{ speaker: 'm', text: 'a' }, { speaker: 'f', text: 'b' }, { speaker: 'n', text: 'c' }, { text: 'd' }], 'es-MX');
    expect(segments).toEqual([
      { text: 'a', locale: 'es-MX', pitch: 0.85 },
      { text: 'b', locale: 'es-MX', pitch: 1.15 },
      { text: 'c', locale: 'es-MX', pitch: 1 },
      { text: 'd', locale: 'es-MX', pitch: 1 },
    ]);
  });

  it('the transcript names A / B when exactly two speakers talk, otherwise it is the plain lines', () => {
    expect(audioTranscript([{ speaker: 'm', text: 'hola' }, { speaker: 'f', text: 'buenas' }, { speaker: 'm', text: 'adiós' }], ['A', 'B'])).toBe('A: hola\nB: buenas\nA: adiós');
    expect(audioTranscript([{ text: 'uno' }, { text: 'dos' }], ['A', 'B'])).toBe('uno\ndos');
    expect(audioTranscript([{ speaker: 'm', text: 'x' }, { speaker: 'f', text: 'y' }, { text: 'z' }], ['A', 'B'])).toBe('x\ny\nz');
  });
});
