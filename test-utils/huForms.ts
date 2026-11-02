import { huRecognises, huStemKeys } from '@/lib/huForms';

// Helpers for the Hungarian form tests: learn some dictionary entries, then ask whether a form is recognised.
export type Learned = [text: string, pos?: string];

function keysOf(learned: Learned[]): Set<string> {
  return new Set(learned.flatMap(([text, pos]) => [text, ...huStemKeys(text, pos)]));
}

export function has(learned: Learned[], ...forms: string[]) {
  const known = keysOf(learned);
  for (const form of forms) expect([form, huRecognises(form, known) || known.has(form)]).toEqual([form, true]);
}

export function lacks(learned: Learned[], ...forms: string[]) {
  const known = keysOf(learned);
  for (const form of forms) expect([form, huRecognises(form, known) || known.has(form)]).toEqual([form, false]);
}

export const noun = (text: string): Learned => [text, 'noun'];
export const verb = (text: string): Learned => [text, 'verb'];
export const adj = (text: string): Learned => [text, 'adj'];
