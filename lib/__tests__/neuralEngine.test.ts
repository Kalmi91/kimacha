// The native layer of the better voice with the packages stubbed: lib/neuralTts.ts (sherpa-onnx engines:
// what each voice loads with, readiness, speaking, stopping) and lib/packAudio.ts (expo-audio).

import { Platform } from 'react-native';

const mockEngines: any[] = [];
const mockCreate = jest.fn();
jest.mock('react-native-sherpa-onnx/tts', () => ({ createStreamingTTS: (...args: unknown[]) => mockCreate(...args) }), { virtual: true });

const mockPlayers: any[] = [];
const mockCreatePlayer = jest.fn();
jest.mock('expo-audio', () => ({ createAudioPlayer: (...args: unknown[]) => mockCreatePlayer(...args) }), { virtual: true });

import { isNeuralReady, loadNeuralVoice, releaseNeural, speakNeural, stopNeural } from '../neuralTts';
import { playPackFile, stopPack } from '../packAudio';
import { KOKORO_VOICES, PIPER_VOICES } from '../neuralVoices';

function fakeEngine(behavior: 'ok' | 'error' | 'hang' = 'ok') {
  const engine: any = {
    getSampleRate: jest.fn(async () => 24000),
    startPcmPlayer: jest.fn(async () => {}),
    writePcmChunk: jest.fn(async () => {}),
    stopPcmPlayer: jest.fn(async () => {}),
    destroy: jest.fn(async () => {}),
    cancel: jest.fn(async () => {}),
    generateSpeechStream: jest.fn(async (_text: string, _opts: unknown, cb: any) => {
      if (behavior === 'ok') {
        cb.onChunk({ samples: [0.1, -0.5, 0.25] });
        cb.onEnd({ cancelled: false });
      } else if (behavior === 'error') {
        cb.onError({ message: 'generation failed' });
      }
      return { cancel: engine.cancel };
    }),
  };
  mockEngines.push(engine);
  return engine;
}

beforeAll(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(console, 'log').mockImplementation(() => {}); // the layer logs its timings
});

afterEach(async () => {
  await releaseNeural();
  mockEngines.length = 0;
  mockPlayers.length = 0;
  mockCreate.mockReset();
  mockCreatePlayer.mockReset();
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('neural engines', () => {
  it('Piper loads as a VITS model, one engine per voice, ready when both voices of the pair are loaded', async () => {
    mockCreate.mockImplementation(async () => fakeEngine());
    const [berta, imre] = PIPER_VOICES.hu;
    expect(isNeuralReady('hu', 'piper')).toBe(false);
    await loadNeuralVoice(berta, 'hu', '/files/tts/vits-piper-hu_HU-berta-medium-int8');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ modelType: 'vits', modelPath: { type: 'file', path: '/files/tts/vits-piper-hu_HU-berta-medium-int8' } }));
    expect(isNeuralReady('hu', 'piper')).toBe(false);
    await loadNeuralVoice(imre, 'hu', '/files/tts/vits-piper-hu_HU-imre-medium-int8');
    expect(isNeuralReady('hu', 'piper')).toBe(true);
    expect(isNeuralReady('en', 'piper')).toBe(false); // another language's pair is not loaded
  });

  it('Kokoro carries its language on the type string, Spanish as es-419, one engine per language over one folder', async () => {
    mockCreate.mockImplementation(async () => fakeEngine());
    const dir = '/files/tts/kokoro-int8-multi-lang-v1_0';
    await loadNeuralVoice(KOKORO_VOICES.es[0], 'es', dir);
    await loadNeuralVoice(KOKORO_VOICES.es[1], 'es', dir);
    expect(mockCreate).toHaveBeenCalledTimes(1); // the Spanish pair shares one engine
    expect(mockCreate.mock.calls[0][0].modelType).toBe('kokoro@es-419');
    expect(isNeuralReady('es', 'kokoro')).toBe(true);
    expect(isNeuralReady('en', 'kokoro')).toBe(false);
    await loadNeuralVoice(KOKORO_VOICES.en[0], 'en', dir);
    expect(mockCreate.mock.calls[1][0].modelType).toBe('kokoro@en-us');
    expect(mockCreate.mock.calls[1][0].modelPath.path).toBe(dir);
  });

  it('a load that is asked twice at once runs once; a broken model rejects and stays not ready', async () => {
    mockCreate.mockImplementation(async () => fakeEngine());
    const voice = PIPER_VOICES.en[0];
    await Promise.all([loadNeuralVoice(voice, 'en', '/d'), loadNeuralVoice(voice, 'en', '/d')]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    mockCreate.mockRejectedValueOnce(new Error('bad model'));
    await expect(loadNeuralVoice(PIPER_VOICES.en[1], 'en', '/broken')).rejects.toThrow('bad model');
    expect(isNeuralReady('en', 'piper')).toBe(false);
  });

  it('speaks with the voice sid and the speed, resolves with timings and calls onDone after the audio played', async () => {
    const engine = fakeEngine();
    mockCreate.mockImplementation(async () => engine);
    const voice = KOKORO_VOICES.es[1];
    await loadNeuralVoice(voice, 'es', '/k');
    const onDone = jest.fn();
    const timings = await speakNeural('Mañana', 'es', voice, { rate: 0.9, onDone });
    expect(engine.generateSpeechStream).toHaveBeenCalledWith('Mañana', { sid: 29, speed: 0.9 }, expect.anything());
    expect(timings.peak).toBe(0.5);
    expect(engine.startPcmPlayer).toHaveBeenCalledWith(24000, 1);
    expect(engine.writePcmChunk).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    await wait(600);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(engine.stopPcmPlayer).toHaveBeenCalled();
  });

  it('a voice that is not loaded rejects, so the caller can use the next level', async () => {
    await expect(speakNeural('hola', 'es', PIPER_VOICES.es[0])).rejects.toThrow('not ready');
  });

  it('an engine error rejects, and the player is released', async () => {
    const engine = fakeEngine('error');
    mockCreate.mockImplementation(async () => engine);
    await loadNeuralVoice(PIPER_VOICES.es[0], 'es', '/p');
    await expect(speakNeural('hola', 'es', PIPER_VOICES.es[0])).rejects.toThrow('generation failed');
    expect(engine.stopPcmPlayer).toHaveBeenCalled();
  });

  it('stopNeural cuts the speech in flight: onStopped once, never onDone', async () => {
    const engine = fakeEngine('hang');
    mockCreate.mockImplementation(async () => engine);
    await loadNeuralVoice(PIPER_VOICES.es[0], 'es', '/p');
    const onDone = jest.fn();
    const onStopped = jest.fn();
    void speakNeural('hola', 'es', PIPER_VOICES.es[0], { onDone, onStopped });
    await wait(20);
    stopNeural();
    await wait(20);
    expect(onStopped).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(engine.cancel).toHaveBeenCalled();
  });

  it('releaseNeural destroys the engines and makes the voices not ready', async () => {
    const engine = fakeEngine();
    mockCreate.mockImplementation(async () => engine);
    await loadNeuralVoice(PIPER_VOICES.hu[0], 'hu', '/p');
    await releaseNeural();
    expect(engine.destroy).toHaveBeenCalled();
    expect(isNeuralReady('hu', 'piper')).toBe(false);
  });
});

// An engine whose native calls take time and are logged in the order they finish, to check how stops and
// the next speech line up (the real player is one per engine, and a late stop kills the next speech's player).
function slowEngine(options: { stopMs?: number; startMs?: number; controllerMs?: number; startFails?: boolean; writeFails?: boolean; hang?: boolean } = {}) {
  const log: string[] = [];
  const engine: any = {
    getSampleRate: jest.fn(async () => 24000),
    startPcmPlayer: jest.fn(async () => {
      if (options.startMs) await wait(options.startMs);
      if (options.startFails) throw new Error('PCM player failed');
      log.push('start');
    }),
    writePcmChunk: jest.fn(async () => {
      if (options.writeFails) throw new Error('write failed');
    }),
    stopPcmPlayer: jest.fn(async () => {
      if (options.stopMs) await wait(options.stopMs);
      log.push('stop');
    }),
    destroy: jest.fn(async () => {}),
    cancel: jest.fn(async () => {
      log.push('cancel');
    }),
    generateSpeechStream: jest.fn(async (_text: string, _opts: unknown, cb: any) => {
      if (options.controllerMs) await wait(options.controllerMs);
      if (!options.hang) {
        cb.onChunk({ samples: [0.1, -0.5, 0.25] });
        cb.onEnd({ cancelled: false });
      }
      return { cancel: engine.cancel };
    }),
  };
  mockEngines.push(engine);
  return { engine, log };
}

describe('neural engines: stops, failures and the one PCM player', () => {
  it('a speech that follows a stop waits for the old player release: cancel and stop land before the next start', async () => {
    const { engine, log } = slowEngine({ stopMs: 15, hang: true });
    mockCreate.mockImplementation(async () => engine);
    const voice = PIPER_VOICES.es[0];
    await loadNeuralVoice(voice, 'es', '/p');
    void speakNeural('uno', 'es', voice);
    await wait(10);
    stopNeural(); // speech.ts cuts the old voice, then speaks the next text
    void speakNeural('dos', 'es', voice);
    await wait(80);
    expect(log).toEqual(['start', 'cancel', 'stop', 'start']);
  });

  it('a write that fails after the generation ended rejects (the caller falls back), onDone stays silent and the player is released', async () => {
    const { engine } = slowEngine({ writeFails: true });
    mockCreate.mockImplementation(async () => engine);
    const voice = PIPER_VOICES.es[0];
    await loadNeuralVoice(voice, 'es', '/p');
    const onDone = jest.fn();
    const onStopped = jest.fn();
    await expect(speakNeural('hola', 'es', voice, { onDone, onStopped })).rejects.toThrow('write failed');
    await wait(600);
    expect(onDone).not.toHaveBeenCalled();
    expect(onStopped).not.toHaveBeenCalled();
    expect(engine.stopPcmPlayer).toHaveBeenCalled();
  });

  it('a stop while the player is starting cuts the speech before any generation begins', async () => {
    const { engine } = slowEngine({ startMs: 30, hang: true });
    mockCreate.mockImplementation(async () => engine);
    const voice = PIPER_VOICES.es[0];
    await loadNeuralVoice(voice, 'es', '/p');
    const onStopped = jest.fn();
    const speech = speakNeural('hola', 'es', voice, { onStopped });
    await wait(10);
    stopNeural();
    await speech;
    await wait(60);
    expect(engine.generateSpeechStream).not.toHaveBeenCalled();
    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  it('a player that fails to start rejects and leaves nothing active: a later stop reports nothing', async () => {
    const { engine } = slowEngine({ startFails: true });
    mockCreate.mockImplementation(async () => engine);
    const voice = PIPER_VOICES.es[0];
    await loadNeuralVoice(voice, 'es', '/p');
    const onStopped = jest.fn();
    await expect(speakNeural('hola', 'es', voice, { onStopped })).rejects.toThrow('PCM player failed');
    stopNeural();
    await wait(20);
    expect(onStopped).not.toHaveBeenCalled();
    expect(engine.stopPcmPlayer).not.toHaveBeenCalled();
  });

  it('a stop before the generation has returned its controller still cancels the generation', async () => {
    const { engine } = slowEngine({ controllerMs: 30, hang: true });
    mockCreate.mockImplementation(async () => engine);
    const voice = PIPER_VOICES.es[0];
    await loadNeuralVoice(voice, 'es', '/p');
    void speakNeural('hola', 'es', voice);
    await wait(10);
    stopNeural();
    await wait(80);
    expect(engine.cancel).toHaveBeenCalledTimes(1);
  });
});

function fakePlayer() {
  const player: any = {
    listener: null as null | ((status: unknown) => void),
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn((_event: string, fn: (status: unknown) => void) => {
      player.listener = fn;
      return { remove: jest.fn() };
    }),
  };
  mockPlayers.push(player);
  return player;
}

describe('word pack player', () => {
  it('plays the file, calls onDone once at the end and releases the player', async () => {
    mockCreatePlayer.mockImplementation(() => fakePlayer());
    const onDone = jest.fn();
    await playPackFile('/files/tts/pack/es/27956ac4.mp3', { onDone });
    expect(mockCreatePlayer).toHaveBeenCalledWith({ uri: 'file:///files/tts/pack/es/27956ac4.mp3' });
    const player = mockPlayers[0];
    expect(player.play).toHaveBeenCalled();
    player.listener({ isLoaded: true, didJustFinish: false });
    player.listener({ isLoaded: true, didJustFinish: true });
    player.listener({ isLoaded: true, didJustFinish: true });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(player.remove).toHaveBeenCalled();
  });

  it('sets the speed only when it is not 1', async () => {
    mockCreatePlayer.mockImplementation(() => fakePlayer());
    await playPackFile('/a.mp3', { rate: 0.8 });
    expect(mockPlayers[0].playbackRate).toBe(0.8);
    await playPackFile('/b.mp3', { rate: 1 });
    expect(mockPlayers[1].playbackRate).toBeUndefined();
  });

  it('the next file cuts the one in flight (onStopped), a stop does too', async () => {
    mockCreatePlayer.mockImplementation(() => fakePlayer());
    const first = { onStopped: jest.fn(), onDone: jest.fn() };
    await playPackFile('/a.mp3', first);
    await playPackFile('/b.mp3', {});
    expect(first.onStopped).toHaveBeenCalledTimes(1);
    expect(mockPlayers[0].remove).toHaveBeenCalled();
    const second = { onStopped: jest.fn() };
    await playPackFile('/c.mp3', second);
    stopPack();
    expect(second.onStopped).toHaveBeenCalledTimes(1);
    expect(first.onDone).not.toHaveBeenCalled();
  });

  it('a file that never loads counts as broken after the timeout: onFail, no onDone', async () => {
    jest.useFakeTimers();
    try {
      mockCreatePlayer.mockImplementation(() => fakePlayer());
      const options = { onFail: jest.fn(), onDone: jest.fn() };
      await playPackFile('/missing.mp3', options);
      jest.advanceTimersByTime(7900);
      expect(options.onFail).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);
      expect(options.onFail).toHaveBeenCalledTimes(1);
      expect(mockPlayers[0].remove).toHaveBeenCalled();
      expect(options.onDone).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a player that cannot be created is onFail', async () => {
    mockCreatePlayer.mockImplementation(() => {
      throw new Error('no audio');
    });
    const onFail = jest.fn();
    await playPackFile('/a.mp3', { onFail });
    expect(onFail).toHaveBeenCalledTimes(1);
  });
});
