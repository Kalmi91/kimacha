import { appLog } from '../appLog.web';
import { errorEntry } from '../appLogFormat';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let saved: Map<string, string>;

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

it('persists only the last 500 web errors across module reloads', () => {
  for (let i = 0; i < 501; i++) appLog.append(errorEntry('js-error', `Failure ${i}`));
  expect(JSON.parse(saved.get('kimacha-diagnostics')!)).toHaveLength(500);
  let reloaded: typeof appLog;
  jest.isolateModules(() => { reloaded = require('../appLog.web').appLog; });
  expect(reloaded!.exportText()).not.toContain('Failure 0\n');
  expect(reloaded!.exportText()).toContain('Failure 500\n');
});

it.each(['invalid json', '{}'])('recovers from corrupt storage: %s', value => {
  saved.set('kimacha-diagnostics', value);
  expect(appLog.exportText()).toBe('Kimacha diagnostics\n');
  appLog.append(errorEntry('render-error', 'Recovered'));
  expect(appLog.exportText()).toContain('Recovered');
});

it('does not collect process exits or require browser storage during server rendering', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
  expect(appLog.lastExitTimestamp()).toBe(0);
  appLog.recordExits();
  expect(() => appLog.append(errorEntry('js-error', 'SSR'))).not.toThrow();
  expect(appLog.exportText()).toBe('Kimacha diagnostics\n');
});
