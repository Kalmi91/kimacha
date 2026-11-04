// The web cloud session ({ name, token }) in localStorage. Every access is wrapped: a private window,
// blocked site data or a missing localStorage (native, tests) means "no session", never a crash.

export interface CloudSession {
  name: string;
  token: string;
}

export const SESSION_KEY = 'kimacha.cloud.session';

// Whoever shows something that depends on being logged in (the weekly leaderboard tab) listens here: save and clear tell it.
const listeners = new Set<() => void>();

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const notify = () => listeners.forEach((fn) => fn());

export function loadSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.name !== 'string' || typeof v.token !== 'string' || !v.token) return null;
    return { name: v.name, token: v.token };
  } catch {
    return null;
  }
}

/** true when the session was stored. */
export function saveSession(session: CloudSession): boolean {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: session.name, token: session.token }));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing stored, nothing to clear
  }
  notify();
}
