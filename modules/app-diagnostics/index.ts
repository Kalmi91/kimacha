import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { ProcessExit } from '../../lib/appLogFormat';

interface AppDiagnosticsNative {
  getProcessExitReasons(sinceMs: number): Promise<ProcessExit[]>;
}

export async function getProcessExitReasons(sinceMs: number): Promise<ProcessExit[]> {
  if (Platform.OS !== 'android') return [];
  const native = requireOptionalNativeModule<AppDiagnosticsNative>('AppDiagnostics');
  return native ? native.getProcessExitReasons(sinceMs) : [];
}
