jest.mock('expo-sqlite', () => ({ openDatabaseSync: (...args: unknown[]) => mockOpen(...args) }));
const initSqlJs = require('sql.js/dist/sql-asm.js');
const mockOpen = jest.fn();
let sql: any;
let raw: any;
let driver: any;
let answerLog: typeof import('../answerLog')['answerLog'];
let max: number;
const entry = (at: number, pair = 'en-es', itemId = String(at)) => ({ at, pair, itemId, thinkMs: 1234, knew: true });
beforeAll(async () => { sql = await initSqlJs(); });
beforeEach(() => {
  raw = new sql.Database();
  const query = (source: string, params: unknown[] = []) => {
    const statement = raw.prepare(source); statement.bind(params);
    const result = [];
    try { while (statement.step()) result.push(statement.getAsObject()); return result; }
    finally { statement.free(); }
  };
  driver = {
    execSync: (source: string) => raw.exec(source), closeSync: jest.fn(),
    runSync: (source: string, params: unknown[] = []) => raw.run(source, params),
    getAllSync: query, getFirstSync: (source: string, params: unknown[]) => query(source, params)[0] ?? null,
    withTransactionSync: (task: () => void) => { raw.exec('BEGIN'); try { task(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
  mockOpen.mockReset().mockReturnValue(driver);
  jest.isolateModules(() => { const store = require('../answerLog'); answerLog = store.answerLog; max = store.MAX_ANSWER_ROWS; });
});
afterEach(() => raw.close());
it('persists pair answers and deletes only that pair latest matching item', () => {
  answerLog.append(entry(0)); answerLog.append(entry(1)); answerLog.append(entry(2, 'es-en'));
  expect(mockOpen).toHaveBeenCalledWith('kimacha-diagnostics.db');
  expect(answerLog.recent('en-es', max)).toEqual([entry(0), entry(1)]);
  answerLog.removeLast('en-es', '0');
  expect(answerLog.recent('en-es', 1)).toEqual([entry(1)]);
  answerLog.removeLast('en-es', '1');
  expect(answerLog.recent('en-es', max)).toEqual([entry(0)]);
  expect(answerLog.recent('es-en', max)).toEqual([entry(2, 'es-en')]);
  answerLog.removeLast('unknown', '0');
});
it('retains at most MAX_ANSWER_ROWS and exports in order', () => {
  expect(answerLog.exportText()).toBe('');
  for (let i = 0; i <= max; i++) answerLog.append(entry(i));
  expect(answerLog.recent('en-es', max)).toHaveLength(max);
  expect(answerLog.recent('en-es', max)[0]).toEqual(entry(1));
  expect(answerLog.exportText()).toContain('1970-01-01T00:00:00.001Z en-es 1 thinkMs=1234 knew=1\n');
  answerLog.append({ ...entry(max + 1), knew: false });
  expect(answerLog.recent('en-es', 1)[0].knew).toBe(false);
});
it.each(['open', 'create', 'write', 'read'])('swallows database failures: %s', mode => {
  const fail = () => { throw new Error('disk error'); };
  if (mode === 'open') mockOpen.mockImplementation(fail);
  if (mode === 'create') driver.execSync = fail;
  if (mode === 'write') driver.runSync = fail;
  if (mode === 'read') { driver.getAllSync = fail; driver.getFirstSync = fail; }
  expect(() => answerLog.append(entry(0))).not.toThrow();
  expect(() => answerLog.removeLast('en-es', '0')).not.toThrow();
  expect(answerLog.recent('en-es', max)).toEqual([]);
  expect(answerLog.exportText()).toBe('');
});
