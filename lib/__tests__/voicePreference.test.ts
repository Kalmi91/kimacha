// Settings -> Voice: the per-language choice store (lib/voicePreference.ts).

import { act, renderHook } from '@testing-library/react-native';
import { DEFAULT_SPEAKERS, normalizeSpeakers } from '../neuralVoices';
import { getSpeakerChoices, preferredGender, setSpeakerChoice, setSpeakerChoices, useSpeakerChoices } from '../voicePreference';

beforeEach(() => {
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});

describe('voicePreference', () => {
  it('starts on the female voice: one person in every language', () => {
    expect(getSpeakerChoices()).toEqual({ es: 'f', en: 'f', hu: 'f', de: 'f' });
    expect(preferredGender('es')).toBe('f');
    expect(preferredGender('en')).toBe('f');
    expect(preferredGender('hu')).toBe('f');
  });

  it('a chosen person is preferred in that language only', () => {
    setSpeakerChoice('es', 'm');
    setSpeakerChoice('hu', 'f');
    expect(preferredGender('es')).toBe('m');
    expect(preferredGender('hu')).toBe('f');
    expect(preferredGender('en')).toBe('f');
  });

  it('an old stored Automatic (or junk) loads as the female voice', () => {
    expect(normalizeSpeakers({ es: 'auto', en: 'm', hu: 'x' })).toEqual({ es: 'f', en: 'm', hu: 'f', de: 'f' });
  });

  it('the hook follows a change, and an unchanged choice does not notify', () => {
    const { result } = renderHook(() => useSpeakerChoices());
    expect(result.current.en).toBe('f');
    act(() => setSpeakerChoice('en', 'm'));
    expect(result.current.en).toBe('m');
    const before = result.current;
    act(() => setSpeakerChoice('en', 'm'));
    expect(result.current).toBe(before);
  });
});
