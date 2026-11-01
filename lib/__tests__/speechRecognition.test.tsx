// lib/speechRecognition.ts: the hook around expo-speech-recognition (the stand-in of jest.setup.js, its listeners are fired with
// __emit) and the wrapper without the native module (an APK built before the package was added).

import { act, renderHook } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import {
  createSpeechRecognition,
  isMicOffError,
  isNothingHeardError,
  loadSpeechRecognition,
  recognitionAvailable,
  useRecognizer,
} from '../speechRecognition';

const { __emit } = require('expo-speech-recognition') as { __emit: (name: string, payload?: unknown) => void };
const native = ExpoSpeechRecognitionModule as unknown as Record<'start' | 'stop' | 'abort' | 'requestPermissionsAsync' | 'isRecognitionAvailable', jest.Mock>;
const emit = (name: string, payload?: unknown) => act(async () => __emit(name, payload));
const final = (transcript: string, isFinal = true) => emit('result', { isFinal, results: [{ transcript, confidence: 1 }] });

beforeEach(() => {
  for (const fn of Object.values(native)) fn.mockReset();
  native.isRecognitionAvailable.mockReturnValue(true);
  native.requestPermissionsAsync.mockResolvedValue({ granted: true });
});

describe('the error codes', () => {
  it('only a microphone that cannot be used is "off"; nothing heard is its own hint; the rest is try again', () => {
    for (const e of ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']) expect(isMicOffError(e)).toBe(true);
    for (const e of ['no-speech', 'speech-timeout', 'network', 'busy', 'client', 'aborted', 'other']) expect(isMicOffError(e)).toBe(false);
    for (const e of ['no-speech', 'speech-timeout']) expect(isNothingHeardError(e)).toBe(true);
    for (const e of ['network', 'busy', 'client', 'not-allowed']) expect(isNothingHeardError(e)).toBe(false);
  });
});

describe('useRecognizer', () => {
  it('start asks for the permission, listens in the language without interim results, and gives the final result once', async () => {
    const seen: string[] = [];
    const { result } = renderHook(() => useRecognizer('es-MX', (text) => seen.push(text)));
    await act(async () => result.current.start());
    expect(native.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es-MX', interimResults: false, continuous: false }));
    await emit('start');
    expect(result.current.listening).toBe(true);
    await final('tengo uno', false);
    expect(seen).toEqual([]);
    await final('  tengo un hermano ');
    expect(seen).toEqual(['tengo un hermano']);
    expect(result.current.transcript).toBe('tengo un hermano');
    // one result per start
    await final('another');
    expect(seen).toEqual(['tengo un hermano']);
    await emit('end');
    expect(result.current.listening).toBe(false);
  });

  it('a denied permission and a failing start end as an error, not as an exception', async () => {
    const { result } = renderHook(() => useRecognizer('es-MX'));
    native.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await act(async () => result.current.start());
    expect(result.current.error).toBe('not-allowed');
    expect(native.start).not.toHaveBeenCalled();
    native.start.mockImplementationOnce(() => {
      throw new Error('no service');
    });
    await act(async () => result.current.start());
    expect(result.current.error).toBe('service-not-allowed');
  });

  it('reset clears the error and the transcript; aborted is no error; start clears the old error', async () => {
    const { result } = renderHook(() => useRecognizer('es-MX'));
    await act(async () => result.current.start());
    await final('hola');
    await emit('error', { error: 'network', message: 'offline' });
    expect(result.current).toMatchObject({ error: 'network', transcript: 'hola', listening: false });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ error: null, transcript: '' });
    await emit('error', { error: 'aborted', message: 'aborted' });
    expect(result.current.error).toBeNull();
    await emit('error', { error: 'speech-timeout', message: 'x' });
    expect(result.current.error).toBe('speech-timeout');
    await act(async () => result.current.start());
    expect(result.current.error).toBeNull();
  });

  it('abort closes the microphone and a result that comes after it is dropped; unmounting closes it too', async () => {
    const seen: string[] = [];
    const { result, unmount } = renderHook(() => useRecognizer('es-MX', (text) => seen.push(text)));
    await act(async () => result.current.start());
    act(() => result.current.abort());
    expect(native.abort).toHaveBeenCalledTimes(1);
    await final('late');
    expect(seen).toEqual([]);
    expect(result.current.transcript).toBe('');
    // nothing open: nothing to abort
    act(() => result.current.abort());
    expect(native.abort).toHaveBeenCalledTimes(1);
    await act(async () => result.current.start());
    native.abort.mockClear();
    unmount();
    expect(native.abort).toHaveBeenCalledTimes(1);
  });

  it('stop asks the service to finish; a native error on stop is swallowed', () => {
    const { result } = renderHook(() => useRecognizer('es-MX'));
    act(() => result.current.stop());
    expect(native.stop).toHaveBeenCalledTimes(1);
    native.stop.mockImplementationOnce(() => {
      throw new Error('x');
    });
    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
  });
});

describe('recognitionAvailable', () => {
  it('asks the device; false on any error', async () => {
    expect(await recognitionAvailable()).toBe(true);
    native.isRecognitionAvailable.mockReturnValue(false);
    expect(await recognitionAvailable()).toBe(false);
    native.isRecognitionAvailable.mockImplementation(() => {
      throw new Error('x');
    });
    expect(await recognitionAvailable()).toBe(false);
  });
});

describe('without the native module', () => {
  it('loadSpeechRecognition gives null when the package cannot be loaded', () => {
    expect(
      loadSpeechRecognition(() => {
        throw new Error("Cannot find native module 'ExpoSpeechRecognition'");
      }),
    ).toBeNull();
    const lib = { ok: true } as never;
    expect(loadSpeechRecognition(() => lib)).toBe(lib);
  });

  it('a wrapper without the package: not available, no events, start reports an error and nothing throws', async () => {
    const none = createSpeechRecognition(null);
    expect(await none.recognitionAvailable()).toBe(false);
    const { result, unmount } = renderHook(() => none.useRecognizer('es-MX'));
    await act(async () => result.current.start());
    expect(result.current.error).toBe('service-not-allowed');
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
    act(() => {
      result.current.stop();
      result.current.abort();
      result.current.reset();
    });
    expect(result.current).toMatchObject({ listening: false, error: null, transcript: '' });
    await emit('result', { isFinal: true, results: [{ transcript: 'hola' }] });
    expect(result.current.transcript).toBe('');
    unmount();
  });
});
