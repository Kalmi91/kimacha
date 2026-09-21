import { act, renderHook } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { useDockLift } from '../useDockLift';

// FB350: shared out of app/(tabs)/index.tsx (Learn) so the PCIC tab's docked
// Check bar lifts above the keyboard the same way. `Keyboard.addListener`
// registers on the shared `DeviceEventEmitter`, so tests drive it from there.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 48 }),
}));

describe('useDockLift', () => {
  it('lifts by keyboard height + bottom inset while open, drops to the inset when closed', () => {
    const { result } = renderHook(() => useDockLift());
    expect(result.current.dockLift).toBe(48); // closed: just the inset

    act(() => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    expect(result.current.kbHeight).toBe(300);
    expect(result.current.dockLift).toBe(348); // 300 + 48

    act(() => {
      DeviceEventEmitter.emit('keyboardDidHide', {});
    });
    expect(result.current.kbHeight).toBe(0);
    expect(result.current.dockLift).toBe(48);
  });
});
