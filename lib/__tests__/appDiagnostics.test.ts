jest.mock('../appLog', () => ({ appLog: {
  append: jest.fn(), lastExitTimestamp: jest.fn(), recordExits: jest.fn(),
} }));
jest.mock('../../modules/app-diagnostics', () => ({ getProcessExitReasons: jest.fn() }));

import { Platform } from 'react-native';
import { appLog } from '../appLog';
import { getProcessExitReasons } from '../../modules/app-diagnostics';

let diagnostics: typeof import('../appDiagnostics');
const previous = jest.fn();
let handler: ReturnType<typeof ErrorUtils.getGlobalHandler>;
const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

beforeEach(() => {
  jest.clearAllMocks();
  (appLog.append as jest.Mock).mockReset();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(ErrorUtils, 'getGlobalHandler').mockReturnValue(previous);
  jest.spyOn(ErrorUtils, 'setGlobalHandler').mockImplementation(next => { handler = next; });
  (appLog.lastExitTimestamp as jest.Mock).mockReturnValue(100);
  (getProcessExitReasons as jest.Mock).mockResolvedValue([]);
  jest.isolateModules(() => { diagnostics = require('../appDiagnostics'); });
});

afterEach(() => {
  jest.restoreAllMocks();
  if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

it('installs once and writes fatal and nonfatal errors before forwarding the original error', () => {
  diagnostics.installErrorLogging();
  diagnostics.installErrorLogging();
  expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
  const error = new Error('Fatal failure');
  handler(error, true);
  expect(appLog.append).toHaveBeenCalledWith(expect.objectContaining({ event: 'js-fatal', message: 'Fatal failure' }));
  expect(previous).toHaveBeenCalledWith(error, true);
  expect((appLog.append as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(previous.mock.invocationCallOrder[0]);
  handler(error, false);
  expect(appLog.append).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'js-error' }));
});

it('always forwards to the previous handler even if logging fails', () => {
  diagnostics.installErrorLogging();
  (appLog.append as jest.Mock).mockImplementation(() => { throw new Error('disk full'); });
  const error = new Error('Original');
  expect(() => handler(error, true)).not.toThrow();
  expect(previous).toHaveBeenCalledWith(error, true);
});

it('records render error component locations without attaching learner data', () => {
  diagnostics.logError('render-error', new Error('Render failure'), '\n at Screen');
  expect(appLog.append).toHaveBeenCalledWith(expect.objectContaining({
    event: 'render-error', message: 'Render failure', stack: expect.stringContaining('at Screen'),
  }));
});

it('enables production Hermes unhandled rejection logging', () => {
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', false);
  const enable = jest.fn();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'HermesInternal');
  Object.defineProperty(globalThis, 'HermesInternal', { configurable: true, value: { enablePromiseRejectionTracker: enable } });
  try {
    diagnostics.installErrorLogging();
    const options = enable.mock.calls[0][0];
    expect(options.allRejections).toBe(true);
    options.onUnhandled(1, new Error('Rejected'));
    expect(appLog.append).toHaveBeenCalledWith(expect.objectContaining({ event: 'unhandled-rejection', message: 'Rejected' }));
  } finally {
    if (original) Object.defineProperty(globalThis, 'HermesInternal', original);
    else Reflect.deleteProperty(globalThis, 'HermesInternal');
  }
});

it('does not crash on an unsupported production rejection tracker', () => {
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', false);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'HermesInternal');
  Object.defineProperty(globalThis, 'HermesInternal', { configurable: true, value: {
    enablePromiseRejectionTracker: () => { throw new Error('unsupported'); },
  } });
  try { expect(() => diagnostics.installErrorLogging()).not.toThrow(); }
  finally {
    if (original) Object.defineProperty(globalThis, 'HermesInternal', original);
    else Reflect.deleteProperty(globalThis, 'HermesInternal');
  }
});

it('captures browser errors and rejections without replacing the browser handlers', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const listeners: Record<string, (event: any) => void> = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener: (name: string, callback: (event: any) => void) => { listeners[name] = callback; },
  } });
  diagnostics.installErrorLogging();
  listeners.error({ error: new Error('Browser failure') });
  listeners.error({ message: 'Script failure' });
  listeners.unhandledrejection({ reason: new Error('Browser rejection') });
  expect((appLog.append as jest.Mock).mock.calls.map(([entry]) => [entry.event, entry.message])).toEqual([
    ['js-error', 'Browser failure'], ['js-error', 'Script failure'], ['unhandled-rejection', 'Browser rejection'],
  ]);
  expect(ErrorUtils.setGlobalHandler).not.toHaveBeenCalled();
});

it('is safe during server rendering', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
  expect(() => diagnostics.installErrorLogging()).not.toThrow();
});

it.each(['ios', 'web'] as const)('does not collect process history on %s', async os => {
  jest.replaceProperty(Platform, 'OS', os);
  await diagnostics.collectProcessExits();
  expect(getProcessExitReasons).not.toHaveBeenCalled();
});

it('passes the persisted cursor to native history and saves the returned batch', async () => {
  const exits = [{ timestamp: 200, reason: 6, description: 'ANR', pssKb: 10, rssKb: 20 }];
  (getProcessExitReasons as jest.Mock).mockResolvedValue(exits);
  await diagnostics.collectProcessExits();
  expect(getProcessExitReasons).toHaveBeenCalledWith(100);
  expect(appLog.recordExits).toHaveBeenCalledWith(exits);
});

it('retries after native or database collection failures without logging recursively', async () => {
  (getProcessExitReasons as jest.Mock).mockRejectedValueOnce(new Error('no history'));
  await expect(diagnostics.collectProcessExits()).resolves.toBeUndefined();
  (appLog.lastExitTimestamp as jest.Mock).mockImplementationOnce(() => { throw new Error('busy'); });
  await expect(diagnostics.collectProcessExits()).resolves.toBeUndefined();
  await diagnostics.collectProcessExits();
  expect(appLog.recordExits).toHaveBeenCalledTimes(1);
  expect(appLog.append).not.toHaveBeenCalled();
});
