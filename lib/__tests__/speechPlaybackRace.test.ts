// Exercise the shared speech router with the real pack and neural adapters, delaying native calls.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('../neuralModels', () => ({
  startNeural: jest.fn(async () => {}),
  neuralPackFile: jest.fn(() => null),
  neuralSentenceFile: jest.fn(() => null),
  neuralEngineFor: jest.fn(() => null),
  chosenNeuralEngine: jest.fn(() => 'kokoro'),
  neuralFallbackEngine: jest.fn(() => null),
  noteNeuralTrouble: jest.fn(),
  noteNeuralOk: jest.fn(),
  releaseStandIns: jest.fn(async () => {}),
}));
const mockCreateEngine = jest.fn();
jest.mock('react-native-sherpa-onnx/tts', () => ({ createStreamingTTS: (...args: unknown[]) => mockCreateEngine(...args) }), { virtual: true });
const mockCreatePlayer = jest.fn();
jest.mock('expo-audio', () => ({ createAudioPlayer: (...args: unknown[]) => mockCreatePlayer(...args) }), { virtual: true });

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import type { StreamingTtsEngine } from 'react-native-sherpa-onnx/tts';
import * as models from '../neuralModels';
import { loadNeuralVoice, releaseNeural } from '../neuralTts';
import { PIPER_VOICES } from '../neuralVoices';
import { noteSpeechTouch, resetVoiceCache, speak, speakAuto, speakSequence, stop } from '../speech';

const speech = Speech as jest.Mocked<typeof Speech>;
const packFile = models.neuralPackFile as jest.Mock;
const engineFor = models.neuralEngineFor as jest.Mock;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const releases: (() => void)[] = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  releases.push(resolve);
  return { promise, resolve };
}

let live: Parameters<StreamingTtsEngine['generateSpeechStream']>[2];
let audible: Set<string>;
let overlaps: string[][];
let log: string[];
const startSound = (name: string) => {
  audible.add(name);
  log.push(name);
  if (audible.size > 1) overlaps.push([...audible]);
};
const engine = {
  getSampleRate: jest.fn(async () => 24000),
  startPcmPlayer: jest.fn(async () => {}),
  writePcmChunk: jest.fn(async () => { startSound('neural'); }),
  stopPcmPlayer: jest.fn(async () => { audible.delete('neural'); }),
  destroy: jest.fn(async () => {}),
  cancelSpeechStream: jest.fn(async () => { live?.onEnd?.({ cancelled: true } as never); }),
  generateSpeechStream: jest.fn(async (_text: string, _options: unknown, handlers: typeof live) => {
    live = handlers;
    handlers?.onChunk?.({ samples: [0.2, 0.3] } as never);
    return { cancel: jest.fn() };
  }),
};

beforeEach(async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.clearAllMocks();
  resetVoiceCache();
  audible = new Set();
  overlaps = [];
  log = [];
  packFile.mockReturnValue(null);
  engineFor.mockReturnValue(null);
  (speech.stop as jest.Mock).mockImplementation(() => { audible.delete('phone'); });
  speech.speak.mockImplementation(() => { startSound('phone'); });
  engine.startPcmPlayer.mockImplementation(async () => {});
  engine.stopPcmPlayer.mockImplementation(async () => { audible.delete('neural'); });
  mockCreateEngine.mockResolvedValue(engine);
  mockCreatePlayer.mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    play: jest.fn(() => { startSound('pack'); }),
    pause: jest.fn(() => { audible.delete('pack'); }),
    remove: jest.fn(),
  }));
  await loadNeuralVoice(PIPER_VOICES.es[0], 'es', '/voices/es');
});

afterEach(async () => {
  releases.splice(0).forEach(resolve => resolve());
  stop();
  await flush();
  await releaseNeural();
  jest.restoreAllMocks();
});

describe('only the latest speech may sound', () => {
  it.each(['pack', 'phone', 'sequence'])('waits for a neural voice to fall silent before starting %s', async route => {
    engineFor.mockReturnValue('piper');
    noteSpeechTouch();
    speakAuto('Old automatic sentence', 'es-MX', { gender: 'f' });
    await flush();
    expect([...audible]).toEqual(['neural']);
    const stopped = deferred();
    engine.stopPcmPlayer.mockImplementation(async () => {
      await stopped.promise;
      audible.delete('neural');
    });
    engineFor.mockReturnValue(null);
    if (route === 'pack') packFile.mockReturnValue('/word.mp3');
    if (route === 'sequence') speakSequence([{ text: 'New word', locale: 'es-MX' }]);
    else speak('New word', 'es-MX');
    await flush();
    expect(log).toEqual(['neural']);
    stopped.resolve();
    await flush();
    expect(log).toEqual(['neural', route === 'pack' ? 'pack' : 'phone']);
    expect(overlaps).toEqual([]);
  });

  it.each(['pack', 'neural'])('waits for phone shutdown before starting %s', async route => {
    speak('Old phone sentence', 'es-MX');
    await flush();
    expect([...audible]).toEqual(['phone']);
    const stopped = deferred();
    speech.stop.mockImplementation(async () => {
      await stopped.promise;
      audible.delete('phone');
    });
    if (route === 'pack') packFile.mockReturnValue('/word.mp3');
    else engineFor.mockReturnValue('piper');
    speak('New word', 'es-MX', { gender: 'f' });
    await flush();
    expect(log).toEqual(['phone']);
    stopped.resolve();
    await flush();
    expect(log).toEqual(['phone', route]);
    expect(overlaps).toEqual([]);
  });

  it('discards rapid taps and an explicit stop while phone shutdown is pending', async () => {
    const stopped = deferred();
    speech.stop.mockReturnValue(stopped.promise);
    speak('First tap', 'es-MX');
    speakSequence([{ text: 'Second tap', locale: 'es-MX' }]);
    stop();
    stopped.resolve();
    await flush();
    expect(speech.speak).not.toHaveBeenCalled();
    expect(mockCreatePlayer).not.toHaveBeenCalled();
    expect(engine.generateSpeechStream).not.toHaveBeenCalled();
  });

  it('plays only the latest rapid tap after a delayed stop', async () => {
    const stopped = deferred();
    speech.stop.mockReturnValue(stopped.promise);
    const onStopped = jest.fn();
    speak('First tap', 'es-MX', { onStopped });
    speak('Second tap', 'es-MX', { onStopped });
    speak('Latest tap', 'es-MX');
    stopped.resolve();
    await flush();
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith('Latest tap ', expect.anything());
    expect(onStopped).toHaveBeenCalledTimes(2);
  });

  it('keeps waiting for the neural stop even when the phone stop rejects', async () => {
    engineFor.mockReturnValue('piper');
    speak('Old sentence', 'es-MX', { gender: 'f' });
    await flush();
    const stopped = deferred();
    engine.stopPcmPlayer.mockImplementation(async () => {
      await stopped.promise;
      audible.delete('neural');
    });
    speech.stop.mockRejectedValue(new Error('No phone engine'));
    packFile.mockReturnValue('/word.mp3');
    speak('New word', 'es-MX');
    await flush();
    expect(log).toEqual(['neural']);
    stopped.resolve();
    await flush();
    expect(log).toEqual(['neural', 'pack']);
    expect(overlaps).toEqual([]);
  });

  it('drops a delayed first chunk and late callbacks from a cancelled automatic run', async () => {
    engine.generateSpeechStream.mockImplementationOnce(async (_text, _options, handlers) => {
      live = handlers;
      return { cancel: jest.fn() };
    });
    engineFor.mockReturnValue('piper');
    const onDone = jest.fn();
    const onStopped = jest.fn();
    noteSpeechTouch();
    speakAuto('Old automatic sentence', 'es-MX', { gender: 'f', onDone, onStopped });
    await flush();
    const old = live;
    packFile.mockReturnValue('/word.mp3');
    speak('New word', 'es-MX');
    await flush();
    old?.onChunk?.({ samples: [0.4, 0.5] } as never);
    old?.onEnd?.({ cancelled: false } as never);
    old?.onError?.({ message: 'Late failure' } as never);
    await flush();
    expect(log).toEqual(['pack']);
    expect(onDone).not.toHaveBeenCalled();
    expect(onStopped).toHaveBeenCalledTimes(1);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('releases a cancelled player only after its delayed start completes', async () => {
    const started = deferred();
    engine.startPcmPlayer.mockImplementation(async () => {
      await started.promise;
      log.push('player started');
    });
    engine.stopPcmPlayer.mockImplementation(async () => { log.push('player stopped'); });
    engineFor.mockReturnValue('piper');
    speak('Old sentence', 'es-MX', { gender: 'f' });
    await flush();
    expect(engine.startPcmPlayer).toHaveBeenCalledTimes(1);
    engineFor.mockReturnValue(null);
    packFile.mockReturnValue('/word.mp3');
    speak('New word', 'es-MX');
    await flush();
    expect(log).toEqual([]);
    started.resolve();
    await flush();
    expect(log).toEqual(['player started', 'player stopped', 'pack']);
    expect(engine.generateSpeechStream).not.toHaveBeenCalled();
  });
});
