import ReactNativeBlobUtil from 'react-native-blob-util';
import { Linking } from 'react-native';
import { getDb } from '@/lib/database';
import { BACKUP_VERSION, isBackupData, type BackupData } from '@/lib/backupData';

// Backup file lives in the phone's public Downloads folder so it survives an
// app uninstall. blob-util's DownloadDir resolves to the real OS path
// (/storage/emulated/0/Download on Android) whatever the phone's UI language is,
// so this works on a Hungarian, English or any other localized phone.
const FILE_NAME = 'kimacha-progress.json';

function backupPath(): string {
  const dir = ReactNativeBlobUtil.fs.dirs.DownloadDir || '/storage/emulated/0/Download';
  return `${dir}/${FILE_NAME}`;
}

// Raised when a file op fails because "all files access" isn't granted yet.
// The UI catches this to guide the user to the one-time OS permission screen.
export class PermissionError extends Error {}

function isPermissionError(e: any): boolean {
  const m = String(e?.message ?? e).toLowerCase();
  return m.includes('permission') || m.includes('eacces') || m.includes('denied') || m.includes('open failed');
}

// Dump all progress to Download/kimacha-progress.json, overwriting any previous
// backup. Returns the written path.
export async function saveProgress(): Promise<string> {
  const data = await getDb().exportAll();
  const json = JSON.stringify(data);
  const path = backupPath();
  try {
    await ReactNativeBlobUtil.fs.writeFile(path, json, 'utf8');
    return path;
  } catch (e) {
    if (isPermissionError(e)) throw new PermissionError('all-files-access');
    throw e;
  }
}

// Restore progress from Download/kimacha-progress.json into the DB (replaces the
// current progress). Throws 'no-file' if there's no backup, 'bad-file' if the
// file is corrupt or a newer format, or PermissionError if access is denied.
export async function loadProgress(): Promise<void> {
  const path = backupPath();
  let raw: string;
  try {
    raw = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
  } catch (e) {
    if (isPermissionError(e)) throw new PermissionError('all-files-access');
    throw new Error('no-file');
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('bad-file');
  }
  if (!isBackupData(data) || data.version > BACKUP_VERSION) throw new Error('bad-file');
  await getDb().importAll(data as BackupData);
}

// Open the OS "all files access" settings screen for a one-time grant.
export function openAllFilesAccessSettings(): void {
  Linking.openSettings().catch(() => {});
}
