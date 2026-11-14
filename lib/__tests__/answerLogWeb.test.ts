import { answerLog, MAX_ANSWER_ROWS } from '../answerLog.web';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let saved: Map<string, string>;
const entry = (at: number, pair = 'en-es', itemId = String(at)) => ({ at, pair, itemId, thinkMs: 1234, knew: true });
beforeEach(() => {
  saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
it('reads chronological recent answers by pair and survives reload', () => {
  answerLog.append(entry(2)); answerLog.append(entry(1, 'es-en')); answerLog.append(entry(3));
  expect(answerLog.recent('en-es', 1)).toEqual([entry(3)]);
  let reloaded: typeof answerLog;
  jest.isolateModules(() => { reloaded = require('../answerLog.web').answerLog; });
  expect(reloaded!.recent('en-es', MAX_ANSWER_ROWS)).toEqual([entry(2), entry(3)]);
  expect(answerLog.recent('es-en', MAX_ANSWER_ROWS)).toEqual([entry(1, 'es-en')]);
});
it('prunes on each write and removes only the latest answer of the pair', () => {
  for (let i = 0; i <= MAX_ANSWER_ROWS; i++) answerLog.append(entry(i));
  expect(answerLog.recent('en-es', MAX_ANSWER_ROWS)).toHaveLength(MAX_ANSWER_ROWS);
  expect(answerLog.recent('en-es', MAX_ANSWER_ROWS)[0].at).toBe(1);
  answerLog.append(entry(MAX_ANSWER_ROWS + 1, 'es-en', 'other'));
  answerLog.removeLast('en-es', 'wrong');
  expect(answerLog.recent('en-es', 1)[0].at).toBe(MAX_ANSWER_ROWS);
  answerLog.removeLast('en-es', String(MAX_ANSWER_ROWS));
  expect(answerLog.recent('en-es', 1)[0].at).toBe(MAX_ANSWER_ROWS - 1);
  expect(answerLog.recent('es-en', 1)).toHaveLength(1);
});
it('exports the required text and returns an empty string for no answers', () => {
  expect(answerLog.exportText()).toBe('');
  answerLog.append(entry(0)); answerLog.append({ ...entry(1), knew: false });
  expect(answerLog.exportText()).toBe('Answer log\n1970-01-01T00:00:00.000Z en-es 0 thinkMs=1234 knew=1\n1970-01-01T00:00:00.001Z en-es 1 thinkMs=1234 knew=0\n');
});
it.each(['bad', '{}', '[null]'])('recovers from corrupt storage %s', value => {
  saved.set('kimacha-answer-log', value);
  expect(answerLog.recent('en-es', MAX_ANSWER_ROWS)).toEqual([]);
  expect(answerLog.exportText()).toBe('');
  answerLog.append(entry(0));
  expect(answerLog.recent('en-es', 1)).toEqual([entry(0)]);
});
it.each(['absent', 'get', 'set', 'property'])('swallows storage failures: %s', mode => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...(mode === 'property' ? { get: () => { throw new Error('blocked'); } } : { value: mode === 'absent' ? undefined : {
    getItem: () => { if (mode === 'get') throw new Error('blocked'); return null; },
    setItem: () => { throw new Error('full'); },
  } }) });
  expect(() => answerLog.append(entry(0))).not.toThrow();
  expect(() => answerLog.removeLast('en-es', '0')).not.toThrow();
  expect(answerLog.recent('en-es', MAX_ANSWER_ROWS)).toEqual([]);
  expect(answerLog.exportText()).toBe('');
});
