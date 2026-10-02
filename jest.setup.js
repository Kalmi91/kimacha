// FB461: a dokkolt Check-sáv (components/learn/useDockLift) a képernyő-hostokban (nyelvtani drill, lecke-teszt,
// szintvizsga) is a safe-area insets-et olvassa; a tesztek nem adnak SafeAreaProvider-t, ezért itt 0 inset.
// Ahol egy teszt saját `jest.mock('react-native-safe-area-context', ...)`-ot ad, az felülírja ezt.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
