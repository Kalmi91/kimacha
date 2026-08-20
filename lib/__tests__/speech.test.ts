// FB144: a missing system voice must not turn into a wrong-language reading.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(),
}));

import * as Speech from 'expo-speech';
import { loadVoices, hasVoiceFor, speak, missingVoiceLanguages, resetVoiceCache } from '@/lib/speech';

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
