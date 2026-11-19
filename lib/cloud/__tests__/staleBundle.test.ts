import { STALE_RELOAD_KEY, reloadIfStale } from '../staleBundle';

const OLD = '/_expo/static/js/web/entry-aaaa1111.js';
const NEW = '/_expo/static/js/web/entry-bbbb2222.js';
const page = (entry: string) => `<html><head><script src="${entry}" defer></script></head><body></body></html>`;

const NAMES = ['document', 'window', 'fetch'] as const;
const saved = NAMES.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)] as const);

function setGlobal(name: (typeof NAMES)[number], value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function memoryStorage() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => (map.has(k) ? map.get(k)! : null), setItem: (k: string, v: string) => void map.set(k, v) };
}

// a page that runs `running` (null: no hashed entry script, as on the dev server) and a server that answers `/` with `served`
function setup({ running, served, storage = memoryStorage() }: { running: string | null; served: string | (() => never) | { status: number }; storage?: unknown }) {
  const reload = jest.fn();
  const scripts = running ? [{ src: `https://kimacha.example${running}` }, { src: '' }] : [{ src: '' }];
  setGlobal('document', { scripts });
  setGlobal('window', { sessionStorage: storage, location: { reload } });
  const fetchMock = jest.fn(async () => {
    if (typeof served === 'function') served();
    if (typeof served === 'object') return { ok: false, status: served.status, text: async () => '' };
    return { ok: true, status: 200, text: async () => page(served as string) };
  });
  setGlobal('fetch', fetchMock);
  return { reload, fetchMock };
}

afterEach(() => {
  for (const [name, desc] of saved) {
    if (desc) Object.defineProperty(globalThis, name, desc);
    else delete (globalThis as Record<string, unknown>)[name];
  }
});

describe('reloadIfStale', () => {
  it('reloads once when the deployed page names another entry bundle', async () => {
    const storage = memoryStorage();
    const { reload, fetchMock } = setup({ running: OLD, served: NEW, storage });
    await expect(reloadIfStale()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/', { cache: 'no-cache' });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.map.get(STALE_RELOAD_KEY)).toBe(NEW);
  });

  it('goes on without a reload when the running bundle is the deployed one', async () => {
    const { reload } = setup({ running: NEW, served: NEW });
    await expect(reloadIfStale()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not loop: after one reload for a deployed bundle, the same mismatch goes on', async () => {
    const storage = memoryStorage();
    storage.setItem(STALE_RELOAD_KEY, NEW);
    const { reload } = setup({ running: OLD, served: NEW, storage });
    await expect(reloadIfStale()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('asks nothing when no hashed entry bundle runs (dev server, tests)', async () => {
    const { reload, fetchMock } = setup({ running: null, served: NEW });
    await expect(reloadIfStale()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['the network fails', () => { throw new Error('offline'); }],
    ['the server answers an error', { status: 503 }],
    ['the page names no entry bundle', '<html></html>'],
  ] as const)('goes on without a reload when %s', async (_label, served) => {
    const { reload } = setup({ running: OLD, served: served as never });
    await expect(reloadIfStale()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('goes on without a reload when session storage is blocked (a reload could not be counted)', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const { reload } = setup({ running: OLD, served: NEW, storage: blocked });
    await expect(reloadIfStale()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
