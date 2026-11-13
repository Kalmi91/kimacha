jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { getProcessExitReasons } from '../../modules/app-diagnostics';

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

it('calls the Android module with the last seen timestamp', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const exits = [{ timestamp: 200, reason: 3, description: null, pssKb: 20, rssKb: 40 }];
  const collect = jest.fn().mockResolvedValue(exits);
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ getProcessExitReasons: collect });
  await expect(getProcessExitReasons(100)).resolves.toEqual(exits);
  expect(requireOptionalNativeModule).toHaveBeenCalledWith('AppDiagnostics');
  expect(collect).toHaveBeenCalledWith(100);
});

it('returns no history in an older Android build without the module', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(null);
  await expect(getProcessExitReasons(0)).resolves.toEqual([]);
});

it.each(['ios', 'web'] as const)('never loads the native module on %s', async os => {
  jest.replaceProperty(Platform, 'OS', os);
  await expect(getProcessExitReasons(0)).resolves.toEqual([]);
  expect(requireOptionalNativeModule).not.toHaveBeenCalled();
});
