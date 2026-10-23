import { SYNC_INTERVAL_MS, detectChange, exportCloudPayload, restoreFromCloud, snapshotKey, startSync } from '../sync';

const mockExport = jest.fn();
const mockImport = jest.fn();
const mockPut = jest.fn();
jest.mock('@/lib/database.web', () => ({
  exportWebState: () => mockExport(),
  importWebState: (raw: string) => mockImport(raw),
}));
jest.mock('../api', () => ({ putProgress: (...args: unknown[]) => mockPut(...args) }));

// The cloud payload of a web state "S<n>" with no resume keys.
const cloud = (n: number) => JSON.stringify({ v: 1, store: `S${n}`, resume: {} });

function setStorage(entries: Record<string, string>, failWrites = false) {
  const keys = Object.keys(entries);
  const store = {
    get length() {
      return keys.length;
    },
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => (k in entries ? entries[k] : null),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error('blocked');
      entries[k] = v;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  return entries;
}

beforeEach(() => {
  mockExport.mockReset();
  mockImport.mockReset();
  mockPut.mockReset();
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

describe('detectChange', () => {
  it('compares the whole payload string', () => {
    expect(detectChange(cloud(1), cloud(1))).toBe(false);
    expect(detectChange(cloud(2), cloud(1))).toBe(true);
  });

  it('counts anything as a change when nothing was uploaded yet', () => {
    expect(detectChange(cloud(0), null)).toBe(true);
  });
});

describe('exportCloudPayload', () => {
  it('wraps the web state and no resume keys where there is no localStorage', async () => {
    mockExport.mockResolvedValue('S1');
    expect(await exportCloudPayload()).toBe(cloud(1));
  });

  it('carries every kimacha-resume key, sorted, and nothing else', async () => {
    mockExport.mockResolvedValue('S1');
    setStorage({ 'kimacha-resume:learn': '{"a":1}', other: 'x', 'kimacha-resume': '/learn' });
    expect(JSON.parse(await exportCloudPayload()).resume).toEqual({ 'kimacha-resume': '/learn', 'kimacha-resume:learn': '{"a":1}' });
    expect(Object.keys(JSON.parse(await exportCloudPayload()).resume)).toEqual(['kimacha-resume', 'kimacha-resume:learn']);
  });
});

describe('restoreFromCloud', () => {
  it('does nothing for a null payload (a new account)', async () => {
    await restoreFromCloud(null);
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('hands the web state to the store and writes the resume keys back', async () => {
    const entries = setStorage({});
    await restoreFromCloud(JSON.stringify({ v: 1, store: 'S7', resume: { 'kimacha-resume': '/learn', 'kimacha-resume:x': '{}', evil: 'y', 'kimacha-resume:n': 5 } }));
    expect(mockImport).toHaveBeenCalledWith('S7');
    expect(entries).toEqual({ 'kimacha-resume': '/learn', 'kimacha-resume:x': '{}' });
  });

  it('survives a localStorage that refuses writes', async () => {
    setStorage({}, true);
    await expect(restoreFromCloud(cloud(1).replace('"resume":{}', '"resume":{"kimacha-resume":"/learn"}'))).resolves.toBeUndefined();
    expect(mockImport).toHaveBeenCalledWith('S1');
  });

  it.each([
    ['a backup-shaped payload', JSON.stringify({ schemaVersion: 2, exportedAt: 'x', appVersion: '1', tables: {} })],
    ['not JSON', 'not json'],
    ['a wrong version', JSON.stringify({ v: 2, store: 'S1', resume: {} })],
    ['a store that is not a string', JSON.stringify({ v: 1, store: {}, resume: {} })],
    ['no resume object', JSON.stringify({ v: 1, store: 'S1' })],
    ['an array resume', JSON.stringify({ v: 1, store: 'S1', resume: [] })],
    ['null', 'null'],
  ])('rejects %s without touching the store', async (_label, payload) => {
    await expect(restoreFromCloud(payload)).rejects.toThrow();
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('lets the store reject a state it cannot read', async () => {
    mockImport.mockRejectedValueOnce(new Error('Not a Kimacha web state'));
    await expect(restoreFromCloud(cloud(1))).rejects.toThrow('Not a Kimacha web state');
  });
});

describe('snapshotKey', () => {
  it('is the payload of the current state, null when the export fails', async () => {
    mockExport.mockResolvedValueOnce('S4');
    expect(await snapshotKey()).toBe(cloud(4));
    mockExport.mockRejectedValueOnce(new Error('db'));
    expect(await snapshotKey()).toBeNull();
  });
});

describe('startSync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function tick() {
    await jest.advanceTimersByTimeAsync(SYNC_INTERVAL_MS);
  }

  it('uploads once when the state changed, and stays quiet while it does not', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const stop = startSync('tok', cloud(0), jest.fn());
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][0]).toBe('tok');
    expect(mockPut.mock.calls[0][1]).toBe(cloud(1));
    await tick();
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('uploads nothing when the state equals the baseline', async () => {
    mockExport.mockResolvedValue('S1');
    const stop = startSync('tok', cloud(1), jest.fn());
    await tick();
    expect(mockPut).not.toHaveBeenCalled();
    stop();
  });

  it('uploads again when the state changes later', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const stop = startSync('tok', null, jest.fn());
    await tick();
    mockExport.mockResolvedValue('S2');
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[1][1]).toBe(cloud(2));
    stop();
  });

  it('retries a failed upload on the next round, silently', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const onBad = jest.fn();
    const stop = startSync('tok', null, onBad);
    await tick();
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(onBad).not.toHaveBeenCalled();
    stop();
  });

  it('survives an export that throws', async () => {
    mockExport.mockRejectedValueOnce(new Error('db')).mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const stop = startSync('tok', null, jest.fn());
    await tick();
    expect(mockPut).not.toHaveBeenCalled();
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops and reports a bad token', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: false, error: 'bad_token' });
    const onBad = jest.fn();
    startSync('tok', null, onBad);
    await tick();
    expect(onBad).toHaveBeenCalledTimes(1);
    await tick();
    await tick();
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('does not upload any more after stop()', async () => {
    mockExport.mockResolvedValue('S1');
    mockPut.mockResolvedValue({ ok: true, data: { updatedAt: 'now' } });
    const stop = startSync('tok', null, jest.fn());
    stop();
    await tick();
    expect(mockPut).not.toHaveBeenCalled();
  });
});
