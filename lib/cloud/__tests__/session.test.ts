import { SESSION_KEY, clearSession, loadSession, saveSession } from '../session';

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
});

describe('cloud session', () => {
  it('stores and reads back { name, token } under the agreed key', () => {
    const store = memoryStorage();
    setStorage(store);
    expect(saveSession({ name: 'Kálmán', token: 'abc' })).toBe(true);
    expect(store.map.has(SESSION_KEY)).toBe(true);
    expect(SESSION_KEY).toBe('kimacha.cloud.session');
    expect(loadSession()).toEqual({ name: 'Kálmán', token: 'abc' });
  });

  it('is gone after clearSession', () => {
    setStorage(memoryStorage());
    saveSession({ name: 'Kálmán', token: 'abc' });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '"abc"'],
    ['no token', JSON.stringify({ name: 'Kálmán' })],
    ['an empty token', JSON.stringify({ name: 'Kálmán', token: '' })],
    ['a numeric token', JSON.stringify({ name: 'Kálmán', token: 5 })],
  ])('reads %s as no session', (_label, raw) => {
    const store = memoryStorage();
    store.map.set(SESSION_KEY, raw);
    setStorage(store);
    expect(loadSession()).toBeNull();
  });

  it('means no session (and no crash) where localStorage does not exist', () => {
    expect(loadSession()).toBeNull();
    expect(saveSession({ name: 'Kálmán', token: 'abc' })).toBe(false);
    expect(() => clearSession()).not.toThrow();
  });

  it('means no session (and no crash) where localStorage throws', () => {
    setStorage(THROWING);
    expect(loadSession()).toBeNull();
    expect(saveSession({ name: 'Kálmán', token: 'abc' })).toBe(false);
    expect(() => clearSession()).not.toThrow();
  });
});
