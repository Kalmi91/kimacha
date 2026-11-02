// Web cloud sync: restore the progress after sign-in, then upload it whenever it changed.
// The server stores the payload string and a revision (`rev`, +1 per save). An upload says which revision it is based on; the
// server refuses (409) one over a newer save, and this device then merges the server's state into its own (merge.ts) and
// uploads the result. The tab also looks at the server when it becomes visible again. The payload is NOT the backup format
// (lib/backup.ts leaves out parts of the learning state): it is the web store's whole state
// (exportWebState in lib/database.web.ts) plus the resume keys of localStorage.

// The explicit .web file: the types of '@/lib/database' are the native ones, and on web both names are the same module.
import { exportWebState, importWebState } from '@/lib/database.web';
import { getProgress, putProgress, type ProgressData } from './api';
import { mergeCloudPayloads } from './merge';

export const SYNC_INTERVAL_MS = 5000;
// Merge-and-upload rounds in one flush before it leaves the rest to the next one (another device saving all the time).
const MAX_CONFLICTS = 3;

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
// `baseRev`: the server revision of the baseline (without it the uploads are unconditional, as before the revisions).
// A 409 (the server has a newer save) merges it into the local state and uploads again; so does the server's state when
// the tab becomes visible: with no local change it is simply taken over.
// A 401 (bad_token) stops the sync and calls onBadToken. Returns the function that stops it.
export function startSync(token: string, baseline: string | null, onBadToken: () => void, baseRev?: number): () => void {
  let last = baseline;
  let rev = baseRev;
  let stopped = false;
  let busy = false;
  let again = false;
  let wantPull = false;
  let conflicts = 0;
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';

  const badToken = () => {
    stop();
    onBadToken();
  };

  // The server holds a save this device has not seen. No local change since the last sync: take its state over. Otherwise
  // merge the local state into it and keep the result locally; the upload that follows sends it.
  const adopt = async (current: ProgressData) => {
    if (current.payload !== null) {
      const local = await exportCloudPayload();
      if (detectChange(local, last)) {
        await restoreFromCloud(mergeCloudPayloads(local, current.payload));
        last = current.payload;
      } else {
        await restoreFromCloud(current.payload);
        last = await exportCloudPayload();
      }
    }
    rev = current.rev;
  };

  const pull = async () => {
    const res = await getProgress(token);
    if (res.ok) {
      if (res.data.rev !== rev) await adopt(res.data);
    } else if (res.error === 'bad_token') {
      badToken();
    }
  };

  const upload = async (keepalive: boolean) => {
    const payload = await exportCloudPayload();
    if (!detectChange(payload, last)) return;
    const res = await putProgress(token, payload, keepalive, rev);
    if (res.ok) {
      last = payload;
      rev = res.data.rev;
    } else if (res.error === 'conflict' && res.current) {
      await adopt(res.current);
      if (++conflicts < MAX_CONFLICTS) again = true;
    } else if (res.error === 'bad_token') {
      badToken();
    }
  };

  // One upload at a time; a request that arrives meanwhile runs once more afterwards. `pullFirst`: look at the server before it.
  const flush = async (keepalive = false, pullFirst = false) => {
    if (stopped) return;
    if (pullFirst) wantPull = true;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    conflicts = 0;
    try {
      do {
        again = false;
        if (wantPull) {
          wantPull = false;
          await pull();
          if (stopped) return;
        }
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
    else void flush(false, true);
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
