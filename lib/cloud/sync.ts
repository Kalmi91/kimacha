// Web cloud sync: restore the progress after sign-in, then upload it whenever it changed.
// The server only stores the payload string; last write wins. The payload is NOT the backup format
// (lib/backup.ts leaves out parts of the learning state): it is the web store's whole state
// (exportWebState in lib/database.web.ts) plus the resume keys of localStorage.

// The explicit .web file: the types of '@/lib/database' are the native ones, and on web both names are the same module.
import { exportWebState, importWebState } from '@/lib/database.web';
import { putProgress } from './api';

export const SYNC_INTERVAL_MS = 5000;

export const PAYLOAD_VERSION = 1;
// lib/resumeRoute.ts ('kimacha-resume') and lib/resumeStore.ts ('kimacha-resume:<key>') keep the learner's place here.
const RESUME_PREFIX = 'kimacha-resume';

// true when the payload differs from the one that was last uploaded (or restored); null = nothing yet.
export function detectChange(payload: string, lastPayload: string | null): boolean {
  return payload !== lastPayload;
}

function readResumeKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(RESUME_PREFIX)) keys.push(key);
    }
    for (const key of keys.sort()) {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    // no localStorage: nothing to carry
  }
  return out;
}

function writeResumeKeys(resume: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(resume)) {
    if (!key.startsWith(RESUME_PREFIX) || typeof value !== 'string') continue;
    try {
      localStorage.setItem(key, value);
    } catch {
      // the place is a convenience, a failed write only loses it
    }
  }
}

// The cloud payload of the local state as it is now.
export async function exportCloudPayload(): Promise<string> {
  return JSON.stringify({ v: PAYLOAD_VERSION, store: await exportWebState(), resume: readResumeKeys() });
}

// Puts the cloud payload into the local DB and localStorage. Throws when it is not a payload of this shape
// (e.g. old backup-shaped data) or the store cannot read it; the shape is checked before anything is written.
export async function restoreFromCloud(payload: string | null): Promise<void> {
  if (payload === null) return;
  const p = JSON.parse(payload);
  if (!p || typeof p !== 'object' || p.v !== PAYLOAD_VERSION || typeof p.store !== 'string' || !p.resume || typeof p.resume !== 'object' || Array.isArray(p.resume)) {
    throw new Error('Not a Kimacha cloud payload');
  }
  await importWebState(p.store);
  writeResumeKeys(p.resume);
}

// The local state as it is now: the baseline for startSync (null if the export fails).
export async function snapshotKey(): Promise<string | null> {
  try {
    return await exportCloudPayload();
  } catch {
    return null;
  }
}

// Uploads every SYNC_INTERVAL_MS, and at once when the tab is hidden or the page goes away, if the payload
// differs from the last upload. A failed upload is silent, the next round retries.
// A 401 (bad_token) stops the sync and calls onBadToken. Returns the function that stops it.
export function startSync(token: string, baseline: string | null, onBadToken: () => void): () => void {
  let last = baseline;
  let stopped = false;
  let busy = false;
  let again = false;
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';

  const upload = async (keepalive: boolean) => {
    const payload = await exportCloudPayload();
    if (!detectChange(payload, last)) return;
    const res = await putProgress(token, payload, keepalive);
    if (res.ok) {
      last = payload;
    } else if (res.error === 'bad_token') {
      stop();
      onBadToken();
    }
  };

  // One upload at a time; a request that arrives meanwhile runs once more afterwards.
  const flush = async (keepalive = false) => {
    if (stopped) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      do {
        again = false;
        await upload(keepalive);
      } while (again && !stopped);
    } catch {
      // export or network failure: the next round tries again
    } finally {
      busy = false;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush(true);
  };
  const onPageHide = () => {
    void flush(true);
  };
  const timer = setInterval(() => void flush(), SYNC_INTERVAL_MS);
  if (hasDom) {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
  }

  function stop() {
    stopped = true;
    clearInterval(timer);
    if (hasDom) {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    }
  }
  return stop;
}
