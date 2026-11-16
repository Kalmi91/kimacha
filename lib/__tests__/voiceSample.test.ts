// EJSZAKA E109: the bundled voice samples. Every (language, engine, person) that exists has an mp3 in
// assets/voice-samples/ and a row in the player table; playing is one at a time and never throws.

import fs from 'fs';
import path from 'path';
import { Platform } from 'react-native';

const mockMake = jest.fn();
jest.mock('../voiceSamplePlayer', () => ({ makeSamplePlayer: (...args: unknown[]) => mockMake(...args) }));

import { PIPER_VOICES, KOKORO_VOICES, type NeuralEngine, type NeuralLang } from '../neuralVoices';
import { getSamplePlaying, playVoiceSample, stopVoiceSample } from '../voiceSample';
import { SAMPLE_KEYS, SAMPLE_SENTENCES, hasSample, sampleKey } from '../voiceSampleData';

const LANGS: NeuralLang[] = ['es', 'en', 'hu', 'de'];
const DIR = path.join(__dirname, '..', '..', 'assets', 'voice-samples');

function fakePlayer() {
  let listener: ((status: { didJustFinish?: boolean }) => void) | null = null;
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn((_event: string, cb: typeof listener) => {
      listener = cb;
      return { remove: jest.fn() };
    }),
  };
  return { player, finish: () => listener?.({ didJustFinish: true }) };
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.useFakeTimers();
  mockMake.mockReset();
  stopVoiceSample();
});
afterEach(() => {
  stopVoiceSample();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('voice sample files', () => {
  it('has a sentence per language and a file for every language, engine and person that has a voice', () => {
    const expected: string[] = [];
    for (const lang of LANGS) {
      expect(SAMPLE_SENTENCES[lang].length).toBeGreaterThan(10);
      for (const engine of ['piper', 'kokoro'] as NeuralEngine[]) {
        const voiced = engine === 'piper' || lang in KOKORO_VOICES;
        for (const gender of ['f', 'm'] as const) {
          expect(hasSample(lang, engine, gender)).toBe(voiced);
          if (voiced) expected.push(`${lang}-${engine}-${gender}`);
        }
      }
    }
    expect(expected).toHaveLength(12);
    expect([...SAMPLE_KEYS].sort()).toEqual([...expected].sort());
    for (const key of expected) {
      const file = path.join(DIR, `${key}.mp3`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(2000);
    }
    expect(fs.readdirSync(DIR).filter(f => f.endsWith('.mp3'))).toHaveLength(12);
  });

  it('the first voice of every pair is the female one and the second the male one (file suffix f / m)', () => {
    for (const lang of LANGS) {
      expect(PIPER_VOICES[lang].map(v => v.gender)).toEqual(['f', 'm']);
    }
    for (const pair of Object.values(KOKORO_VOICES)) {
      expect(pair.map(v => v.gender)).toEqual(['f', 'm']);
    }
  });

  it('the whole set is at most 1 MB', () => {
    const total = SAMPLE_KEYS.reduce((sum, key) => sum + fs.statSync(path.join(DIR, `${key}.mp3`)).size, 0);
    expect(total).toBeLessThanOrEqual(1_000_000);
  });
});

describe('playVoiceSample', () => {
  it('plays the file of the key, shows it as playing, and clears when it ends', () => {
    const f = fakePlayer();
    mockMake.mockReturnValue(f.player);
    playVoiceSample('hu', 'piper', 'f');
    expect(mockMake).toHaveBeenCalledWith(sampleKey('hu', 'piper', 'f'));
    expect(f.player.play).toHaveBeenCalledTimes(1);
    expect(getSamplePlaying()).toBe('hu-piper-f');
    f.finish();
    expect(getSamplePlaying()).toBeNull();
    expect(f.player.remove).toHaveBeenCalledTimes(1);
  });

  it('a new sample stops the one before', () => {
    const a = fakePlayer();
    const b = fakePlayer();
    mockMake.mockReturnValueOnce(a.player).mockReturnValueOnce(b.player);
    playVoiceSample('es', 'kokoro', 'f');
    playVoiceSample('en', 'piper', 'm');
    expect(a.player.pause).toHaveBeenCalled();
    expect(a.player.remove).toHaveBeenCalled();
    expect(b.player.play).toHaveBeenCalled();
    expect(getSamplePlaying()).toBe('en-piper-m');
    a.finish(); // a late end of the old one must not clear the new one
    expect(getSamplePlaying()).toBe('en-piper-m');
  });

  it('does nothing for a sample that does not exist (Hungarian Kokoro) and never throws when the player breaks', () => {
    playVoiceSample('hu', 'kokoro', 'f');
    expect(mockMake).not.toHaveBeenCalled();
    mockMake.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(() => playVoiceSample('de', 'piper', 'm')).not.toThrow();
    expect(getSamplePlaying()).toBeNull();
  });

  it('a sample that never ends frees the button after a few seconds', () => {
    const f = fakePlayer();
    mockMake.mockReturnValue(f.player);
    playVoiceSample('de', 'piper', 'f');
    jest.advanceTimersByTime(9000);
    expect(getSamplePlaying()).toBeNull();
  });
});
