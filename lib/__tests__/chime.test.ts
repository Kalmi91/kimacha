// FB549: the right-answer chime (lib/chime.ts) with expo-audio stubbed: it plays the bundled file once, tells
// the caller when it has ended, and never leaves the caller waiting when it cannot play.

import { Platform } from 'react-native';

const mockCreatePlayer = jest.fn();
jest.mock('expo-audio', () => ({ createAudioPlayer: (...args: unknown[]) => mockCreatePlayer(...args) }), { virtual: true });
// the bundled file stands in as a plain module id, so the test does not depend on the asset transform (on the CI
// runner playChime skipped the player while it played locally)
jest.mock('../../assets/sounds/correct.wav', () => 1, { virtual: true });

import { playChime } from '../chime';

function fakePlayer() {
  let listener: ((status: { didJustFinish?: boolean }) => void) | null = null;
  const sub = { remove: jest.fn() };
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn((_event: string, cb: typeof listener) => {
      listener = cb;
      return sub;
    }),
  };
  return { player, sub, finish: () => listener?.({ didJustFinish: true }) };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockCreatePlayer.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('playChime', () => {
  it('plays the bundled file, then calls back once and releases the player', () => {
    const f = fakePlayer();
    mockCreatePlayer.mockReturnValue(f.player);
    const onDone = jest.fn();
    playChime(onDone);
    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
    expect(f.player.play).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    f.finish();
    f.finish();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(f.sub.remove).toHaveBeenCalled();
    expect(f.player.remove).toHaveBeenCalled();
  });

  it('a chime that never finishes hands over after the limit', () => {
    const f = fakePlayer();
    mockCreatePlayer.mockReturnValue(f.player);
    const onDone = jest.fn();
    playChime(onDone);
    jest.advanceTimersByTime(1400);
    expect(onDone).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(f.player.remove).toHaveBeenCalled();
  });

  it('a player that cannot be made calls back at once', () => {
    mockCreatePlayer.mockImplementation(() => {
      throw new Error('no audio');
    });
    const onDone = jest.fn();
    playChime(onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('works without a callback', () => {
    mockCreatePlayer.mockImplementation(() => {
      throw new Error('no audio');
    });
    expect(() => playChime()).not.toThrow();
  });

  it('the web build is silent and calls back at once', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onDone = jest.fn();
    playChime(onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockCreatePlayer).not.toHaveBeenCalled();
  });
});
