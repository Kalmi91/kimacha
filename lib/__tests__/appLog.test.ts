jest.mock('expo-sqlite', () => ({ openDatabaseSync: (...args: unknown[]) => mockOpen(...args) }));
jest.mock('../appBuild', () => ({ appBuildTag: () => 'v4.1.41 (41)' }));
jest.mock('../../modules/app-diagnostics', () => ({ getProcessExitReasons: (...args: unknown[]) => mockExits(...args) }));

import { Platform } from 'react-native';
import { diagnosticText, errorEntry, type ProcessExit } from '../appLogFormat';

const initSqlJs = require('sql.js/dist/sql-asm.js');
const mockOpen = jest.fn();
const mockExits = jest.fn();
let sql: any;
let raw: any;
let driver: any;
let appLog: typeof import('../appLog')['appLog'];

function reloadStore() {
  jest.isolateModules(() => { appLog = require('../appLog').appLog; });
}

function rows() {
  return driver.getAllSync('SELECT * FROM app_log ORDER BY seq');
}

const exit = (timestamp: number, reason = 3): ProcessExit => ({
  timestamp, reason, description: 'Low memory', pssKb: 128, rssKb: 256,
});

beforeAll(async () => { sql = await initSqlJs(); });

beforeEach(() => {
  raw = new sql.Database();
  driver = {
    execSync: (source: string) => raw.exec(source),
    closeSync: jest.fn(),
    runSync: jest.fn((source: string, params: unknown[] = []) => raw.run(source, params)),
    getAllSync: (source: string) => {
      const statement = raw.prepare(source);
      const result = [];
      try {
        while (statement.step()) result.push(statement.getAsObject());
        return result;
      } finally { statement.free(); }
    },
    getFirstSync: (source: string) => driver.getAllSync(source)[0] ?? null,
    withTransactionSync: (task: () => void) => {
      raw.exec('BEGIN');
      try { task(); raw.exec('COMMIT'); }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  mockOpen.mockReset().mockReturnValue(driver);
  mockExits.mockReset();
  reloadStore();
});

afterEach(() => { raw.close(); jest.restoreAllMocks(); });

it('stores a thrown JS error synchronously, including time, build and first stack frames', () => {
  let thrown: Error | undefined;
  try { throw new Error('Unexpected failure'); } catch (error) { thrown = error as Error; }
  appLog.append(errorEntry('js-fatal', thrown));
  expect(rows()).toEqual([expect.objectContaining({
    timestamp: expect.any(Number), version: 'v4.1.41 (41)', event: 'js-fatal',
    message: 'Unexpected failure', stack: expect.stringContaining('appLog.test.ts'),
  })]);
  // Simulate a new JS process opening the persisted database.
  reloadStore();
  expect(appLog.exportText()).toContain('Unexpected failure');
  expect(mockOpen).toHaveBeenCalledWith('kimacha-diagnostics.db');
});

it('keeps exactly the latest 500 entries, including mixed errors and process exits', () => {
  for (let i = 0; i < 501; i++) appLog.append(errorEntry('js-error', `Failure ${i}`));
  expect(rows()).toHaveLength(500);
  expect(rows()[0].message).toBe('Failure 1');
  appLog.recordExits([exit(100)]);
  expect(rows()).toHaveLength(500);
  expect(rows()[0].message).toBe('Failure 2');
  expect(rows()[499].event).toBe('process-exit');
});

it('records only new exits, preserves equal timestamps in a batch and persists its cursor', () => {
  appLog.recordExits([exit(200), exit(100), exit(200, 6)]);
  expect(rows().map((row: any) => row.timestamp)).toEqual([100, 200, 200]);
  expect(rows()[2].message).toContain('reason=6 (anr)');
  expect(rows()[0].message).toContain('pssKb=128; rssKb=256; Low memory');
  reloadStore();
  appLog.recordExits([exit(100), exit(200), exit(300)]);
  expect(rows()).toHaveLength(4);
  expect(appLog.lastExitTimestamp()).toBe(300);
});

it('caps each native history batch at the newest ten entries', () => {
  appLog.recordExits(Array.from({ length: 15 }, (_, i) => exit(i + 1)));
  expect(rows().map((row: any) => row.timestamp)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
});

it('rolls back both rows and cursor if a batch cannot be saved, allowing a clean retry', () => {
  appLog.lastExitTimestamp();
  const run = driver.runSync.getMockImplementation();
  driver.runSync.mockImplementation((source: string, params: unknown[]) => {
    if (source.startsWith('UPDATE diagnostics_meta')) throw new Error('disk full');
    return run(source, params);
  });
  expect(() => appLog.recordExits([exit(100)])).toThrow('disk full');
  expect(rows()).toHaveLength(0);
  expect(appLog.lastExitTimestamp()).toBe(0);
  driver.runSync.mockImplementation(run);
  appLog.recordExits([exit(100)]);
  expect(rows()).toHaveLength(1);
});

it('retries opening after a schema failure', () => {
  mockOpen.mockReturnValueOnce({ ...driver, execSync: () => { throw new Error('busy'); } });
  expect(() => appLog.lastExitTimestamp()).toThrow('busy');
  expect(driver.closeSync).toHaveBeenCalled();
  expect(appLog.lastExitTimestamp()).toBe(0);
});

it('exports an empty log and unknown exit reasons as readable text', () => {
  expect(appLog.exportText()).toBe('Kimacha diagnostics\n');
  appLog.recordExits([{ ...exit(100, 99), description: null }]);
  expect(appLog.exportText()).toContain('1970-01-01T00:00:00.100Z v4.1.41 (41) process-exit');
  expect(appLog.exportText()).toContain('reason=99 (unknown)');
});

it('collects mocked Android history only once concurrently and deduplicates after restart', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  mockExits.mockResolvedValue([exit(200), exit(100)]);
  let diagnostics: typeof import('../appDiagnostics');
  jest.isolateModules(() => { diagnostics = require('../appDiagnostics'); });
  await Promise.all([diagnostics!.collectProcessExits(), diagnostics!.collectProcessExits()]);
  expect(mockExits).toHaveBeenCalledTimes(1);
  expect(rows()).toHaveLength(2);
  jest.isolateModules(() => { diagnostics = require('../appDiagnostics'); });
  await diagnostics!.collectProcessExits();
  expect(mockExits).toHaveBeenLastCalledWith(200);
  expect(rows()).toHaveLength(2);
});

it('redacts dynamic values, bounds text and does not serialize arbitrary error objects', () => {
  const text = diagnosticText('bad "learner answer" {"word":"secret"} user@example.com https://host/?token=x /data/user/0/app/file token=abc pin=123');
  for (const privateValue of ['learner answer', 'secret', 'user@example.com', 'token=x', '/data/user', 'abc', '123']) {
    expect(text).not.toContain(privateValue);
  }
  expect(diagnosticText('x'.repeat(3000))).toHaveLength(2000);
  expect(errorEntry('js-error', { answer: 'private' }).message).toBe('Unknown error');
  expect(errorEntry('js-error', 'Failure').message).toBe('Failure');
  const error = new Error('bad "private"');
  error.stack = 'bad private\n' + Array.from({ length: 20 }, (_, i) => `at frame${i}`).join('\n');
  const entry = errorEntry('render-error', error, '\n at Screen\n at Root');
  expect(entry.stack).not.toContain('private');
  expect(entry.stack).toContain('frame7');
  expect(entry.stack).not.toContain('frame8');
  expect(entry.stack).toContain('at Screen');
});
