// FB144: a missing system voice must not turn into a wrong-language reading.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(),
}));

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { loadVoices, hasVoiceFor, speak, missingVoiceLanguages, resetVoiceCache, voiceIdFor, speechTag } from '@/lib/speech';

const mocked = Speech as jest.Mocked<typeof Speech>;

const withVoices = async (languages: string[]) => {
  resetVoiceCache();
  (mocked.speak as jest.Mock).mockClear();
  (mocked.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(
    languages.map(language => ({ language })) as any,
  );
  await loadVoices();
};

describe('speech voices', () => {
  it('speaks in a language the device has a voice for', async () => {
    await withVoices(['en-US', 'hu-HU']);
    speak('fiútestvér', 'hu-HU');
    expect(mocked.speak).toHaveBeenCalledWith('fiútestvér', { language: 'hu-HU' });
  });

  it('stays silent instead of reading Hungarian with an English voice', async () => {
    await withVoices(['en-US', 'es-ES']);
    expect(hasVoiceFor('hu-HU')).toBe(false);
    speak('fiútestvér', 'hu-HU');
    expect(mocked.speak).not.toHaveBeenCalled();
    expect(missingVoiceLanguages()).toEqual(['hu']);
  });

  it('matches on the language, not the region', async () => {
    await withVoices(['hu-hu']);
    expect(hasVoiceFor('hu-HU')).toBe(true);
    expect(hasVoiceFor('hu')).toBe(true);
  });

  it('behaves as before when the platform lists no voices', async () => {
    await withVoices([]);
    speak('brother', 'en-US');
    expect(mocked.speak).toHaveBeenCalledWith('brother', { language: 'en-US' });
  });

  it('behaves as before when the voice query throws', async () => {
    resetVoiceCache();
    (mocked.speak as jest.Mock).mockClear();
    (mocked.getAvailableVoicesAsync as jest.Mock).mockRejectedValue(new Error('no tts'));
    await loadVoices();
    speak('brother', 'en-US');
    expect(mocked.speak).toHaveBeenCalledWith('brother', { language: 'en-US' });
  });

  it('never speaks empty text', async () => {
    await withVoices(['en-US']);
    speak('', 'en-US');
    expect(mocked.speak).not.toHaveBeenCalled();
  });
});

// FB144 second pass, 2026-08-22: expo-speech's Android module builds the locale
// with `Locale("hu-HU")`, which is NOT a BCP-47 parse, so the tag was dropped and
// the engine read Hungarian with the device's default voice. Android now gets the
// bare code, and a concrete voice id when the device names one.
describe('what actually reaches the engine', () => {
  const withVoiceList = async (voices: any[]) => {
    resetVoiceCache();
    (mocked.speak as jest.Mock).mockClear();
    (mocked.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(voices);
    await loadVoices();
  };

  it('keeps the full tag on ios, where BCP-47 is what the API wants', async () => {
    // jest-expo runs this suite as ios; the android branch is asserted below.
    expect(Platform.OS).toBe('ios');
    await withVoiceList([{ language: 'hu-HU', identifier: 'hu-hu-x-kfl', quality: 'Default' }]);
    speak('fiútestvér', 'hu-HU');
    expect((mocked.speak as jest.Mock).mock.calls[0][1].language).toBe('hu-HU');
  });

  it('strips the region on android, where Locale("hu-HU") is unparsable', () => {
    const os = Platform.OS;
    // Platform.OS is a plain field at runtime, so the android branch is testable
    // from the ios project jest-expo gives us.
    (Platform as { OS: string }).OS = 'android';
    try {
      expect(speechTag('hu-HU')).toBe('hu');
      expect(speechTag('es-ES')).toBe('es');
    } finally {
      (Platform as { OS: string }).OS = os;
    }
  });

  it('pins the device voice for the language when there is one', async () => {
    await withVoiceList([
      { language: 'en-US', identifier: 'en-us-x-sfg', quality: 'Default' },
      { language: 'hu-HU', identifier: 'hu-hu-x-kfl', quality: 'Default' },
    ]);
    speak('fiútestvér', 'hu-HU');
    expect((mocked.speak as jest.Mock).mock.calls[0][1].voice).toBe('hu-hu-x-kfl');
  });

  it('prefers an enhanced voice over a default one', async () => {
    await withVoiceList([
      { language: 'hu-HU', identifier: 'hu-basic', quality: 'Default' },
      { language: 'hu-HU', identifier: 'hu-enhanced', quality: 'Enhanced' },
    ]);
    expect(voiceIdFor('hu-HU')).toBe('hu-enhanced');
  });

  it('sends no voice id when the platform listed none', async () => {
    await withVoiceList([]);
    speak('brother', 'en-US');
    expect((mocked.speak as jest.Mock).mock.calls[0][1].voice).toBeUndefined();
  });

  it('keeps the language of one card out of another card', async () => {
    await withVoiceList([
      { language: 'en-US', identifier: 'en-us-x-sfg', quality: 'Default' },
      { language: 'es-ES', identifier: 'es-es-x-eed', quality: 'Default' },
    ]);
    speak('el hermano', 'es-ES');
    speak('brother', 'en-US');
    const [first, second] = (mocked.speak as jest.Mock).mock.calls;
    expect(first[1].voice).toBe('es-es-x-eed');
    expect(second[1].voice).toBe('en-us-x-sfg');
  });
});

// A phone that owns several voices for one language must still get the region
// that was asked for: a Mexican learner is not served the Castilian voice.
describe('region-aware voice pick', () => {
  const withVoiceList = async (voices: any[]) => {
    resetVoiceCache();
    (mocked.speak as jest.Mock).mockClear();
    (mocked.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(voices);
    await loadVoices();
  };

  const spanish = [
    { language: 'es-ES', identifier: 'es-es-x-eed', quality: 'Default' },
    { language: 'es-MX', identifier: 'es-mx-x-jfm', quality: 'Default' },
    { language: 'es-US', identifier: 'es-us-x-sfb', quality: 'Enhanced' },
  ];

  it('takes the exact region when the device has it', async () => {
    await withVoiceList(spanish);
    expect(voiceIdFor('es-MX')).toBe('es-mx-x-jfm');
    expect(voiceIdFor('es-ES')).toBe('es-es-x-eed');
  });

  it('falls back to the best voice of the language when the region is missing', async () => {
    await withVoiceList(spanish);
    expect(voiceIdFor('es-AR')).toBe('es-us-x-sfb'); // the enhanced one
  });

  it('still prefers enhanced inside the requested region', async () => {
    await withVoiceList([
      { language: 'es-MX', identifier: 'es-mx-basic', quality: 'Default' },
      { language: 'es-MX', identifier: 'es-mx-enhanced', quality: 'Enhanced' },
      { language: 'es-ES', identifier: 'es-es-enhanced', quality: 'Enhanced' },
    ]);
    expect(voiceIdFor('es-MX')).toBe('es-mx-enhanced');
  });

  it('counts an identifier-less voice as the language being present, but pins nothing', async () => {
    await withVoiceList([{ language: 'hu-HU', identifier: '', quality: 'Default' }]);
    expect(hasVoiceFor('hu-HU')).toBe(true);
    expect(voiceIdFor('hu-HU')).toBeUndefined();
  });
});
