import { Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { appLog } from './appLog';
import { t } from './i18n';

export async function exportAppLog(): Promise<void> {
  const s = t().settings.diagnostics;
  try {
    const text = appLog.exportText();
    const name = 'kimacha-diagnostics.txt';
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      return;
    }
    // One cache file, replaced on each export, so exports cannot grow unbounded.
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: s.export });
  } catch {
    if (Platform.OS === 'web') window.alert(s.exportError);
    else Alert.alert(s.export, s.exportError);
  }
}
