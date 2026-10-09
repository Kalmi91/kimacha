// The docked Check bar (components/learn/useDockLift) also reads the safe-area insets in the screen hosts
// (grammar drill, lesson test, level exam); tests do not provide a SafeAreaProvider, so the insets are 0 here.
// A test that supplies its own `jest.mock('react-native-safe-area-context', ...)` overrides this.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
