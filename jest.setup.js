// The docked Check bar (components/learn/useDockLift) also reads the safe-area insets in the screen hosts
// (grammar drill, lesson test, level exam); tests do not provide a SafeAreaProvider, so the insets are 0 here.
// A test that supplies its own `jest.mock('react-native-safe-area-context', ...)` overrides this.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Every screen and lib test runs against the in-memory sql.js database (lib/database.web), not
// expo-sqlite; the mock is keyed by the resolved file, so the relative `./database` imports inside
// lib/ get it too. A test of the native layer (nativeDb, migrationsSql, ...) opts out with
// `jest.unmock('../database')` or supplies its own jest.mock.
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

// expo-speech-recognition is native code: tests get a stand-in whose listeners can be fired with __emit(event, payload)
// (the last listener registered for an event wins, like the component that renders last).
jest.mock('expo-speech-recognition', () => {
  const listeners = {};
  return {
    ExpoSpeechRecognitionModule: {
      isRecognitionAvailable: jest.fn(() => true),
      requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    useSpeechRecognitionEvent: (name, listener) => {
      listeners[name] = listener;
    },
    __emit: (name, payload) => listeners[name]?.(payload),
  };
});
