// The web content packs (lib/games/content/webPacks.ts): the `<x>.index.web.ts` twins read lessons from a cache that the web gate
// fills from dist/content/<pack>.json before the app mounts. `fetch` is mocked; the pack list is a two-pack stand-in.
jest.mock('../content/webPacks.generated', () => ({ WEB_PACKS: [{ name: 'p1', dir: 'a' }, { name: 'p2', dir: 'b' }] }));

type WebPacks = typeof import('../content/webPacks');
const fresh = (): WebPacks => {
  let mod!: WebPacks;
  jest.isolateModules(() => {
    mod = require('../content/webPacks');
  });
  return mod;
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  (globalThis as { fetch?: unknown }).fetch = mockFetch;
  mockFetch.mockImplementation(async (url: string) => ok({ lesson: { from: url } }));
});

describe('web content packs', () => {
  it('packEntry gives the entry of a loaded pack, synchronously', async () => {
    const { packEntry, prefetchContentPacks } = fresh();
    await prefetchContentPacks();
    expect(packEntry('p1', 'lesson')).toEqual({ from: '/content/p1.json' });
    expect(packEntry('p2', 'lesson')).toEqual({ from: '/content/p2.json' });
  });

  it('packEntry throws a clear error before the pack is loaded, and for an id the pack does not have', async () => {
    const { packEntry, prefetchContentPacks } = fresh();
    expect(() => packEntry('p1', 'lesson')).toThrow('web content pack p1 not loaded');
    await prefetchContentPacks();
    expect(() => packEntry('p1', 'nope')).toThrow('web content pack p1 has no entry nope');
  });

  it('fetches every pack from /content/<pack>.json, once: the second call is the same promise', async () => {
    const { prefetchContentPacks } = fresh();
    const first = prefetchContentPacks();
    expect(prefetchContentPacks()).toBe(first);
    await first;
    await prefetchContentPacks();
    expect(mockFetch.mock.calls.map((c) => c[0]).sort()).toEqual(['/content/p1.json', '/content/p2.json']);
  });

  it('rejects on a bad status and on a network error, and each time the next call tries again', async () => {
    const { packEntry, prefetchContentPacks } = fresh();
    mockFetch.mockImplementationOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(prefetchContentPacks()).rejects.toThrow('web content pack p1: HTTP 503');

    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(prefetchContentPacks()).rejects.toThrow('offline');

    await prefetchContentPacks();
    expect(packEntry('p1', 'lesson')).toEqual({ from: '/content/p1.json' });
  });
});
