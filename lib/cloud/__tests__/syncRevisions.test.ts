// lib/cloud/sync.ts with the server revisions: the revision an upload is based on, the merge after a conflict (409), and the
// look at the server when the tab becomes visible. The web store and the API are stand-ins (the real pair against the real
// Durable Object is the two-device case in cloudWorker.test.ts); the merge rules themselves are in merge.test.ts.
import { SYNC_INTERVAL_MS, startSync } from '../sync';

const mockExport = jest.fn();
const mockImport = jest.fn();
const mockPut = jest.fn();
const mockGet = jest.fn();
jest.mock('@/lib/database.web', () => ({
  exportWebState: () => mockExport(),
  importWebState: (raw: string) => mockImport(raw),
}));
jest.mock('../api', () => ({
  putProgress: (...args: unknown[]) => mockPut(...args),
  getProgress: (...args: unknown[]) => mockGet(...args),
}));

// The cloud payload of a web state "S<n>" with no resume keys.
const cloud = (n: number) => JSON.stringify({ v: 1, store: `S${n}`, resume: {} });
// A web store state with the given usage days, and the cloud payload around a store.
const store = (days: Record<string, number>) => JSON.stringify({ v: 1, streak: { current_count: 0, last_date: null, longest_count: 0 }, usageMinutes: Object.entries(days), dailyXp: [], pcicCards: [] });
const payloadOf = (storeText: string) => JSON.stringify({ v: 1, store: storeText, resume: {} });
const daysOf = (call: unknown[]) => Object.fromEntries(JSON.parse(JSON.parse(call[1] as string).store).usageMinutes);

beforeEach(() => {
  mockExport.mockReset();
  mockImport.mockReset();
  mockPut.mockReset();
  mockGet.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as any).localStorage;
});

async function tick() {
  await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
}

// The store as the importer left it: the next export gives back what was imported.
function importKeepsState() {
  mockImport.mockImplementation(async (raw: string) => {
    mockExport.mockResolvedValue(raw);
  });
}

describe('the revision of an upload', () => {
  it('is the one it started with, then the one the server answered', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 4 } });
    const stop = startSync('tok', null, jest.fn(), 3);
    await tick();
    expect(mockPut.mock.calls[0][3]).toBe(3);
    mockExport.mockResolvedValue('S2');
    await tick();
    expect(mockPut.mock.calls[1][3]).toBe(4);
    stop();
  });

  it('is none when the sync was started without one (the uploads stay unconditional)', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const stop = startSync('tok', null, jest.fn());
    await tick();
    expect(mockPut.mock.calls[0][3]).toBeUndefined();
    stop();
  });
});

describe('a conflict (409)', () => {
  it('merges the server state into the local one, keeps the result locally and uploads it at once on the new revision', async () => {
    importKeepsState();
    mockExport.mockResolvedValue(store({ '2026-10-20': 5, '2026-10-22': 8 }));
    const remote = payloadOf(store({ '2026-10-20': 9, '2026-10-21': 4 }));
    mockPut
      .mockResolvedValueOnce({ ok: false, error: 'conflict', current: { payload: remote, updatedAt: 'x', rev: 7 } })
      .mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 8 } });
    const stop = startSync('tok', payloadOf(store({ '2026-10-20': 5 })), jest.fn(), 6);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[0][3]).toBe(6);
    expect(mockPut.mock.calls[1][3]).toBe(7);
    expect(daysOf(mockPut.mock.calls[1])).toEqual({ '2026-10-20': 9, '2026-10-21': 4, '2026-10-22': 8 });
    expect(JSON.parse(mockImport.mock.calls[0][0]).usageMinutes).toHaveLength(3);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    mockExport.mockResolvedValue(store({ '2026-10-23': 1 }));
    await tick();
    expect(mockPut.mock.calls[2][3]).toBe(8);
    stop();
  });

  it('is answered by overwriting a server state it cannot read, on the revision of that state', async () => {
    mockExport.mockResolvedValue(store({ '2026-10-20': 5 }));
    mockPut
      .mockResolvedValueOnce({ ok: false, error: 'conflict', current: { payload: 'not json', updatedAt: 'x', rev: 2 } })
      .mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 3 } });
    const stop = startSync('tok', null, jest.fn(), 1);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[1][3]).toBe(2);
    expect(daysOf(mockPut.mock.calls[1])).toEqual({ '2026-10-20': 5 });
    stop();
  });

  it('leaves the rest to the next round when the server keeps answering conflict', async () => {
    importKeepsState();
    mockExport.mockResolvedValue(store({ '2026-10-20': 5 }));
    let rev = 1;
    mockPut.mockImplementation(async () => ({ ok: false, error: 'conflict', current: { payload: payloadOf(store({ '2026-10-21': 1 })), updatedAt: 'x', rev: ++rev } }));
    const stop = startSync('tok', null, jest.fn(), 1);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(3);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(6);
    stop();
  });

  it('without a state in the answer changes nothing, and the next round tries again', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValueOnce({ ok: false, error: 'conflict' }).mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 2 } });
    const stop = startSync('tok', null, jest.fn(), 1);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[1][3]).toBe(1);
    stop();
  });
});

describe('when the tab becomes visible', () => {
  const originals = { document: (globalThis as any).document, window: (globalThis as any).window };
  let state = 'visible';
  const handlers: Record<string, () => void> = {};

  beforeEach(() => {
    state = 'visible';
    (globalThis as any).document = {
      get visibilityState() {
        return state;
      },
      addEventListener: (type: string, fn: () => void) => {
        handlers[type] = fn;
      },
      removeEventListener: (type: string) => {
        delete handlers[type];
      },
    };
    (globalThis as any).window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete (globalThis as any)[key];
      else (globalThis as any)[key] = value;
    }
  });

  const show = async () => {
    state = 'visible';
    handlers.visibilitychange();
    await jest.advanceTimersByTimeAsync(0);
  };

  it('takes over the server state when it is newer and nothing changed here, without uploading', async () => {
    importKeepsState();
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: true, data: { payload: cloud(5), updatedAt: 'x', rev: 3 } });
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 4 } });
    const stop = startSync('tok', cloud(1), jest.fn(), 2);
    await show();
    expect(mockGet).toHaveBeenCalledWith('tok');
    expect(mockImport).toHaveBeenCalledWith('S5');
    expect(mockPut).not.toHaveBeenCalled();
    await tick();
    expect(mockPut).not.toHaveBeenCalled();
    mockExport.mockResolvedValue('S6');
    await tick();
    expect(mockPut.mock.calls[0][3]).toBe(3);
    stop();
  });

  it('merges and uploads when the server state is newer and something changed here', async () => {
    importKeepsState();
    mockExport.mockResolvedValue(store({ '2026-10-22': 8 }));
    mockGet.mockResolvedValue({ ok: true, data: { payload: payloadOf(store({ '2026-10-21': 4 })), updatedAt: 'x', rev: 3 } });
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 4 } });
    const stop = startSync('tok', payloadOf(store({})), jest.fn(), 2);
    await show();
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][3]).toBe(3);
    expect(daysOf(mockPut.mock.calls[0])).toEqual({ '2026-10-21': 4, '2026-10-22': 8 });
    stop();
  });

  it('leaves everything alone when the server is still at the revision of this device', async () => {
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: true, data: { payload: cloud(1), updatedAt: 'x', rev: 2 } });
    const stop = startSync('tok', cloud(1), jest.fn(), 2);
    await show();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockImport).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
    stop();
  });

  it('only learns the revision when the newer server state is empty', async () => {
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: true, data: { payload: null, updatedAt: null, rev: 5 } });
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 6 } });
    const stop = startSync('tok', null, jest.fn(), 2);
    await show();
    expect(mockImport).not.toHaveBeenCalled();
    expect(mockPut.mock.calls[0][3]).toBe(5);
    stop();
  });

  it('stops and reports a bad token without uploading', async () => {
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: false, error: 'bad_token' });
    const onBad = jest.fn();
    startSync('tok', null, onBad, 2);
    await show();
    expect(onBad).toHaveBeenCalledTimes(1);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('stays silent when the server cannot be reached, and uploads on the normal round', async () => {
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: false, error: 'network' });
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 3 } });
    const onBad = jest.fn();
    const stop = startSync('tok', null, onBad, 2);
    await show();
    expect(onBad).not.toHaveBeenCalled();
    expect(mockImport).not.toHaveBeenCalled();
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not ask the server when the tab is hidden, only uploads', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 3 } });
    const stop = startSync('tok', null, jest.fn(), 2);
    state = 'hidden';
    handlers.visibilitychange();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('asks the server after the running upload when the tab shows up during it', async () => {
    mockExport.mockResolvedValue('S1');
    mockGet.mockResolvedValue({ ok: true, data: { payload: null, updatedAt: null, rev: 3 } });
    let release!: () => void;
    mockPut.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ ok: true, data: { updatedAt: 'now', rev: 3 } }))));
    const stop = startSync('tok', null, jest.fn(), 2);
    await tick();
    await show();
    expect(mockGet).not.toHaveBeenCalled();
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockGet).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not listen any more after stop()', () => {
    mockExport.mockResolvedValue('S1');
    const stop = startSync('tok', cloud(1), jest.fn(), 2);
    expect(handlers.visibilitychange).toBeDefined();
    stop();
    expect(handlers.visibilitychange).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
