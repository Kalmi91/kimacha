import * as fc from 'fast-check';
import { MAX_PAYLOAD_CHARS, parsePayload } from '../../../cloud/logic';
import { SYNC_INTERVAL_MS, exportCloudPayload, restoreFromCloud, startSync } from '../sync';

// Property tests of the payload the web client builds and reads back (lib/cloud/sync.ts), against the server's
// parsePayload. The seed is fixed so CI is deterministic; FC_SEED=<n> searches elsewhere.
const RUN = { numRuns: 300, seed: Number(process.env.FC_SEED ?? 20261101) };

const mockExport = jest.fn();
const mockImport = jest.fn();
const mockPut = jest.fn();
jest.mock('@/lib/database.web', () => ({
  exportWebState: () => mockExport(),
  importWebState: (raw: string) => mockImport(raw),
}));
jest.mock('../api', () => ({ putProgress: (...args: unknown[]) => mockPut(...args) }));

function setStorage(entries: Record<string, string>) {
  const store = {
    get length() {
      return Object.keys(entries).length;
    },
    key: (i: number) => Object.keys(entries)[i] ?? null,
    getItem: (k: string) => (k in entries ? entries[k] : null),
    setItem: (k: string, v: string) => {
      entries[k] = v;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  return entries;
}

beforeEach(() => {
  mockExport.mockReset();
  mockImport.mockReset();
  mockImport.mockResolvedValue(undefined);
  mockPut.mockReset();
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

const resumeKey = fc.string({ maxLength: 12 }).map((s) => `kimacha-resume${s ? ':' + s : ''}`);
const resumeArb = fc.dictionary(resumeKey, fc.string({ unit: 'binary', maxLength: 60 }), { maxKeys: 5 });
const storeArb = fc.oneof(fc.string({ unit: 'binary', maxLength: 400 }), fc.json());

describe('cloud payload round trip', () => {
  it('carries the web state and the resume keys through export, the JSON wire, the server check and restore', async () => {
    await fc.assert(
      fc.asyncProperty(storeArb, resumeArb, fc.dictionary(fc.string({ maxLength: 8 }).filter((k) => !k.startsWith('kimacha-resume')), fc.string({ maxLength: 20 }), { maxKeys: 3 }), async (store, resume, other) => {
        mockImport.mockClear();
        mockExport.mockResolvedValue(store);
        setStorage({ ...other, ...resume });
        const payload = await exportCloudPayload();

        const served = parsePayload(JSON.parse(JSON.stringify({ payload })));
        expect(served).toEqual({ ok: true, payload });

        const entries = setStorage({});
        await restoreFromCloud(payload);
        expect(mockImport).toHaveBeenCalledTimes(1);
        expect(mockImport).toHaveBeenCalledWith(store);
        expect(entries).toEqual(resume); // the resume keys, and only those
      }),
      RUN
    );
  });

  it('rejects anything that is not a payload with an Error, before it writes anything', async () => {
    const valid = { v: 1, store: 'S', resume: { 'kimacha-resume': '/learn' } };
    const mutated = fc.tuple(fc.constantFrom('v', 'store', 'resume'), fc.jsonValue()).map(([key, value]) => JSON.stringify({ ...valid, [key]: value }));
    const raws = fc.oneof(fc.string({ unit: 'binary', maxLength: 120 }), fc.jsonValue().map((j) => JSON.stringify(j)), mutated);
    await fc.assert(
      fc.asyncProperty(raws, async (raw) => {
        mockImport.mockClear();
        const entries = setStorage({});
        let p: any = null;
        try {
          p = JSON.parse(raw);
        } catch {
          // not JSON: never well-formed
        }
        const wellFormed = !!p && typeof p === 'object' && p.v === 1 && typeof p.store === 'string' && !!p.resume && typeof p.resume === 'object' && !Array.isArray(p.resume);
        let error: unknown = null;
        try {
          await restoreFromCloud(raw);
        } catch (e) {
          error = e;
        }
        if (wellFormed) {
          expect(error).toBeNull();
          expect(mockImport).toHaveBeenCalledWith(p.store);
        } else {
          expect(error).toBeInstanceOf(Error);
          expect(mockImport).not.toHaveBeenCalled();
          expect(entries).toEqual({});
        }
      }),
      RUN
    );
  });
});

// The Worker keeps the payload in one SQLite string of its Durable Object, whose limit is 2 MB per string / row
// (developers.cloudflare.com/durable-objects/platform/limits, "Maximum string, BLOB or table row size"). The unit
// of that limit is not spelled out there (bytes of the UTF-8 text is the reading used here).
const STORAGE_LIMIT_BYTES = 2 * 1024 * 1024;

describe('payload size limits', () => {
  // FINDING D2-3 (skipped: red = the bug; see report-d2.md): 1M characters of 3 bytes are 3 MB.
  it.skip('only accepts payloads that fit the storage row of the Worker', () => {
    // the worst case the character limit lets through: a payload made of 3-byte characters
    const payload = '€'.repeat(MAX_PAYLOAD_CHARS);
    const accepted = parsePayload({ payload }).ok;
    expect(!accepted || Buffer.byteLength(payload, 'utf8') <= STORAGE_LIMIT_BYTES).toBe(true);
  });

  describe('a payload the server refuses as too_large', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // FINDING D2-4 (skipped: red = the bug; see report-d2.md): sync.ts ignores 'too_large' and PUTs the same body every 5 s.
    it.skip('is not uploaded again every round while it stays the same', async () => {
      mockExport.mockResolvedValue('x'.repeat(MAX_PAYLOAD_CHARS));
      mockPut.mockResolvedValue({ ok: false, error: 'too_large' });
      const stop = startSync('tok', null, jest.fn());
      for (let i = 0; i < 4; i++) await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
      expect(mockPut.mock.calls.length).toBeLessThanOrEqual(1);
      stop();
    });
  });
});
