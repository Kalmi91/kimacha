// Web guest mode: a first visit goes straight into the app, the "save your progress?" offer comes after a few graded
// cards, and the settings row can ask for the sign-in later. The two flags live in localStorage (per browser); every
// access is wrapped like in session.ts: a private window or blocked site data means "not stored", never a crash.
// The card counter and the guest state are in memory only (one page life), with a small subscribe API for the gate.
import { useSyncExternalStore } from 'react';

export const VISITED_KEY = 'kimacha.cloud.visited';
export const OFFER_DONE_KEY = 'kimacha.cloud.saveOfferDone';
// Graded cards in one page life before the save offer shows up.
export const GUEST_OFFER_AFTER = 5;

function isFlagSet(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // not stored: the next start behaves as the first one
  }
}

export const hasVisited = (): boolean => isFlagSet(VISITED_KEY);
export const markVisited = (): void => setFlag(VISITED_KEY);
export const isOfferDone = (): boolean => isFlagSet(OFFER_DONE_KEY);
export const markOfferDone = (): void => setFlag(OFFER_DONE_KEY);

let cardsGraded = 0;
const gradedListeners = new Set<(count: number) => void>();

/** One card was graded (any grade; an undo does not count). Safe where nobody listens (native). */
export function noteCardGraded(): void {
  cardsGraded += 1;
  for (const cb of [...gradedListeners]) cb(cardsGraded);
}

export function subscribeCardsGraded(cb: (count: number) => void): () => void {
  gradedListeners.add(cb);
  return () => {
    gradedListeners.delete(cb);
  };
}

let guest = false;
const guestListeners = new Set<() => void>();

const subscribeGuest = (cb: () => void) => {
  guestListeners.add(cb);
  return () => {
    guestListeners.delete(cb);
  };
};

export function setCloudGuest(value: boolean): void {
  if (guest === value) return;
  guest = value;
  for (const cb of [...guestListeners]) cb();
}

/** true while the web app runs without a cloud account (the Settings sign-in row shows only then). */
export function useIsCloudGuest(): boolean {
  return useSyncExternalStore(subscribeGuest, () => guest, () => false);
}

const signInListeners = new Set<() => void>();

/** The Settings row asks the gate to open the sign-in. */
export function requestCloudSignIn(): void {
  for (const cb of [...signInListeners]) cb();
}

export function subscribeSignInRequests(cb: () => void): () => void {
  signInListeners.add(cb);
  return () => {
    signInListeners.delete(cb);
  };
}

/** Tests only: back to a fresh page life. */
export function resetGuestStateForTests(): void {
  cardsGraded = 0;
  guest = false;
  gradedListeners.clear();
  guestListeners.clear();
  signInListeners.clear();
}
