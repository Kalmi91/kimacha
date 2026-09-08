// Headless stand-in for react-native-reanimated, used by the game playthrough
// tests (app/games/__tests__/). The real package needs its native Worklets
// runtime, which jest has no way to boot ("Native part of Worklets doesn't seem
// to be initialized"), so the two arcade games that animate (word-rain,
// bubble-pop) could not be mounted at all.
//
// The mock is deliberately NOT a no-op: `withTiming` parks the animation and
// the test decides when it lands (`finishAnimations()`), which is exactly what
// a falling-tile simulation needs, "let this tile reach the bottom line" is a
// test step, not a race against a real timer.

import { View } from 'react-native';

type Finisher = { id: number; run: (finished: boolean) => void; owner: object };

let nextId = 1;
const pending: Finisher[] = [];

interface AnimationDescriptor {
  __animation: true;
  toValue: number;
  callback?: (finished: boolean) => void;
}

function isAnimation(v: unknown): v is AnimationDescriptor {
  return !!v && typeof v === 'object' && (v as AnimationDescriptor).__animation === true;
}

export function withTiming(toValue: number, _config?: unknown, callback?: (finished: boolean) => void) {
  return { __animation: true as const, toValue, callback };
}

export function withSpring(toValue: number, _config?: unknown, callback?: (finished: boolean) => void) {
  return { __animation: true as const, toValue, callback };
}

export function useSharedValue<T>(initial: T) {
  const box = {
    _value: initial as unknown,
    get value() {
      return this._value as T;
    },
    set value(next: T) {
      if (isAnimation(next)) {
        const anim = next;
        const self = this;
        pending.push({
          id: nextId++,
          owner: self,
          run: (finished: boolean) => {
            self._value = anim.toValue;
            anim.callback?.(finished);
          },
        });
        return;
      }
      this._value = next;
    },
  };
  return box as { value: T };
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function cancelAnimation(sv: object) {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].owner === sv) pending.splice(i, 1);
  }
}

export function runOnJS<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export const Easing = {
  linear: 'linear',
  ease: 'ease',
  in: (x: unknown) => x,
  out: (x: unknown) => x,
  inOut: (x: unknown) => x,
  bezier: () => 'bezier',
};

/** Land every animation currently in flight (the tile reaches the bottom). */
export function finishAnimations() {
  const batch = pending.splice(0, pending.length);
  for (const entry of batch) entry.run(true);
  return batch.length;
}

/** How many animations are in flight right now. */
export function inFlightCount(): number {
  return pending.length;
}

/** Drop every in-flight animation without firing its callback (between tests). */
export function resetAnimations() {
  pending.length = 0;
}

const Animated = {
  View,
  Text: View,
  ScrollView: View,
  createAnimatedComponent: (C: unknown) => C,
};

export default Animated;
