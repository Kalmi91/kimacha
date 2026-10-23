// Name + PIN rules of the web cloud login, shared by the login screen (lib/cloud/) and the
// Worker (cloud/worker.ts), so the two can never disagree about what an account name is.

export const NAME_MIN = 2;
export const NAME_MAX = 24;

// The account key: NFC, trimmed, inner whitespace collapsed, lowercased.
// "Kálmán " and "kálmán" are the same account; the typed form is kept only for display.
export function nameKey(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isValidName(raw: string): boolean {
  const k = nameKey(raw);
  return k.length >= NAME_MIN && k.length <= NAME_MAX;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
