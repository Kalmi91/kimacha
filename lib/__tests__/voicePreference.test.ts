// Settings -> Voice: the per-language choice store (lib/voicePreference.ts).

import { act, renderHook } from '@testing-library/react-native';
import { DEFAULT_SPEAKERS } from '../neuralVoices';
import { getSpeakerChoices, preferredGender, setSpeakerChoice, setSpeakerChoices, useSpeakerChoices } from '../voicePreference';

beforeEach(() => setSpeakerChoices({ ...DEFAULT_SPEAKERS }));

describe('voicePreference', () => {
  it('starts on Automatic: no preferred person in any language', () => {
    expect(getSpeakerChoices()).toEqual({ es: 'auto', en: 'auto', hu: 'auto', de: 'auto' });
    expect(preferredGender('es')).toBeUndefined();
    expect(preferredGender('en')).toBeUndefined();
    expect(preferredGender('hu')).toBeUndefined();
  });

  it('a chosen person is preferred in that language only, and Automatic takes it back', () => {
    setSpeakerChoice('es', 'm');
    setSpeakerChoice('hu', 'f');
    expect(preferredGender('es')).toBe('m');
    expect(preferredGender('hu')).toBe('f');
    expect(preferredGender('en')).toBeUndefined();
    setSpeakerChoice('es', 'auto');
    expect(preferredGender('es')).toBeUndefined();
  });

  it('the hook follows a change, and an unchanged choice does not notify', () => {
    const { result } = renderHook(() => useSpeakerChoices());
    expect(result.current.en).toBe('auto');
    act(() => setSpeakerChoice('en', 'f'));
    expect(result.current.en).toBe('f');
    const before = result.current;
    act(() => setSpeakerChoice('en', 'f'));
    expect(result.current).toBe(before);
  });
});
