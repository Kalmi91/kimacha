import { act, renderHook } from '@testing-library/react-native';

import {
  GUEST_OFFER_AFTER,
  OFFER_DONE_KEY,
  VISITED_KEY,
  hasVisited,
  isOfferDone,
  markOfferDone,
  markVisited,
  noteCardGraded,
  requestCloudSignIn,
  resetGuestStateForTests,
  setCloudGuest,
  subscribeCardsGraded,
  subscribeSignInRequests,
  useIsCloudGuest,
} from '../guest';

function setStorage(value: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const THROWING = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

afterEach(() => {
  delete (globalThis as any).localStorage;
  resetGuestStateForTests();
});

describe('guest flags', () => {
  it('a first visit has not visited; after markVisited every later one has (under the agreed key)', () => {
    const store = memoryStorage();
    setStorage(store);
    expect(hasVisited()).toBe(false);
    markVisited();
    expect(VISITED_KEY).toBe('kimacha.cloud.visited');
    expect(store.map.has(VISITED_KEY)).toBe(true);
    expect(hasVisited()).toBe(true);
  });

  it('the save offer is open until markOfferDone (under the agreed key)', () => {
    const store = memoryStorage();
    setStorage(store);
    expect(isOfferDone()).toBe(false);
    markOfferDone();
    expect(OFFER_DONE_KEY).toBe('kimacha.cloud.saveOfferDone');
    expect(store.map.has(OFFER_DONE_KEY)).toBe(true);
    expect(isOfferDone()).toBe(true);
  });

  it.each([
    ['does not exist', undefined],
    ['throws', THROWING],
  ])('acts as nothing stored (and does not crash) where localStorage %s', (_label, storage) => {
    if (storage) setStorage(storage);
    expect(() => {
      markVisited();
      markOfferDone();
    }).not.toThrow();
    expect(hasVisited()).toBe(false);
    expect(isOfferDone()).toBe(false);
  });
});

describe('graded-card counter', () => {
  it('tells every subscriber the running count, until it unsubscribes', () => {
    const seen: number[] = [];
    const off = subscribeCardsGraded((n) => seen.push(n));
    noteCardGraded();
    noteCardGraded();
    off();
    noteCardGraded();
    expect(seen).toEqual([1, 2]);
  });

  it('counts with nobody listening (native) and keeps counting for a later subscriber', () => {
    for (let i = 0; i < GUEST_OFFER_AFTER - 1; i++) noteCardGraded();
    const seen: number[] = [];
    subscribeCardsGraded((n) => seen.push(n));
    noteCardGraded();
    expect(seen).toEqual([GUEST_OFFER_AFTER]);
  });

  it('starts again from 1 after the test reset', () => {
    noteCardGraded();
    resetGuestStateForTests();
    const seen: number[] = [];
    subscribeCardsGraded((n) => seen.push(n));
    noteCardGraded();
    expect(seen).toEqual([1]);
  });
});

describe('guest state and sign-in requests', () => {
  it('useIsCloudGuest follows setCloudGuest', () => {
    const { result } = renderHook(() => useIsCloudGuest());
    expect(result.current).toBe(false);
    act(() => setCloudGuest(true));
    expect(result.current).toBe(true);
    act(() => setCloudGuest(true));
    expect(result.current).toBe(true);
    act(() => setCloudGuest(false));
    expect(result.current).toBe(false);
  });

  it('requestCloudSignIn reaches the subscribers until they unsubscribe', () => {
    const cb = jest.fn();
    const off = subscribeSignInRequests(cb);
    requestCloudSignIn();
    off();
    requestCloudSignIn();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
