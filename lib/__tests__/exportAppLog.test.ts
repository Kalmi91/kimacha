jest.mock('../appLog', () => ({ appLog: { exportText: jest.fn() } }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ uri: 'file:///cache/kimacha-diagnostics.txt', create: mockCreate, write: mockWrite })),
  Paths: { cache: 'file:///cache' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

import { Alert, Platform } from 'react-native';
import { File } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { appLog } from '../appLog';
import { exportAppLog } from '../exportAppLog';
import { setLanguage, t } from '../i18n';

const mockCreate = jest.fn();
const mockWrite = jest.fn();
const text = 'Kimacha diagnostics\n\n2026-11-12T00:00:00.000Z v4.1.41 js-error\nFailure\n';
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const savedCreateUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const savedRevokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockReset();
  mockWrite.mockReset();
  jest.replaceProperty(Platform, 'OS', 'android');
  (appLog.exportText as jest.Mock).mockReset().mockReturnValue(text);
  (shareAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  setLanguage('en');
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const [target, name, descriptor] of [
    [globalThis, 'document', savedDocument], [globalThis, 'window', savedWindow],
    [URL, 'createObjectURL', savedCreateUrl], [URL, 'revokeObjectURL', savedRevokeUrl],
  ] as const) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else Reflect.deleteProperty(target, name);
  }
  setLanguage('en');
});

it.each(['en', 'es', 'hu', 'de'] as const)('shares a UTF-8 text log with the %s title', async lang => {
  setLanguage(lang);
  await exportAppLog();
  expect(File).toHaveBeenCalledWith('file:///cache', 'kimacha-diagnostics.txt');
  expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
  expect(mockWrite).toHaveBeenCalledWith(text);
  expect(shareAsync).toHaveBeenCalledWith('file:///cache/kimacha-diagnostics.txt', {
    mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: t().settings.diagnostics.export,
  });
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('shows a translated error if the database cannot be read', async () => {
  setLanguage('hu');
  (appLog.exportText as jest.Mock).mockImplementation(() => { throw new Error('busy'); });
  await exportAppLog();
  expect(Alert.alert).toHaveBeenCalledWith('Napló exportálása', 'A napló exportálása nem sikerült.');
  expect(shareAsync).not.toHaveBeenCalled();
});

it('handles file write and sharing failures', async () => {
  mockWrite.mockImplementationOnce(() => { throw new Error('disk full'); });
  await exportAppLog();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(shareAsync).not.toHaveBeenCalled();
  (shareAsync as jest.Mock).mockRejectedValue(new Error('unavailable'));
  await exportAppLog();
  expect(Alert.alert).toHaveBeenCalledTimes(2);
});

it.each([false, true])('downloads the log on web and releases the URL (download fails: %s)', async fails => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const link = { href: '', download: '', click: jest.fn(() => { if (fails) throw new Error('download blocked'); }) };
  const alert = jest.fn();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => link } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { alert } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:log') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  await exportAppLog();
  expect(link.href).toBe('blob:log');
  expect(link.download).toBe('kimacha-diagnostics.txt');
  expect(link.click).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:log');
  expect(alert).toHaveBeenCalledTimes(fails ? 1 : 0);
  expect(shareAsync).not.toHaveBeenCalled();
});
