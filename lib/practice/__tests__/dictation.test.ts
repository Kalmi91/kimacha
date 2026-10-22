// Dictation round logic (lib/practice/dictation.ts): pure state moves, grading, the saved-state check.

import type { PcicItem } from '@/data/pcic';
import {
  checkDictation,
  currentWordId,
  dictationDone,
  dictationPosition,
  dictationScore,
  dictationWord,
  isDictationRight,
  nextDictation,
  parseDictation,
  startDictation,
} from '../dictation';

const IDS = ['a', 'b', 'c'];
const item = (es: string, en: string): PcicItem => ({ id: 'x', es, en, kind: 'word', section: '', order: 1 });

describe('a round of dictation', () => {
  it('starts on the first word, nothing done, no feedback', () => {
    const s = startDictation(IDS);
    expect(s).toEqual({ queue: IDS, retried: [], firstTry: [], turn: 0, checked: null });
    expect(currentWordId(s)).toBe('a');
    expect(dictationPosition(s, 3)).toBe(1);
  });

  it('a right word is done after Next and counts for the score', () => {
    let s = checkDictation(startDictation(IDS), 'x', true);
    expect(s.checked).toEqual({ typed: 'x', right: true });
    expect(dictationScore(s)).toBe(1);
    s = nextDictation(s);
    expect(s.queue).toEqual(['b', 'c']);
    expect(s.checked).toBeNull();
    expect(s.turn).toBe(1);
    expect(dictationPosition(s, 3)).toBe(2);
  });

  it('a wrong word goes to the end once more and does not count for the score; wrong twice it is done', () => {
    let s = nextDictation(checkDictation(startDictation(IDS), 'bad', false));
    expect(s.queue).toEqual(['b', 'c', 'a']);
    expect(s.retried).toEqual(['a']);
    expect(dictationScore(s)).toBe(0);
    s = nextDictation(checkDictation(s, 'ok', true));
    s = nextDictation(checkDictation(s, 'ok', true));
    // 'a' is back: right now = done, but not on the first try
    s = nextDictation(checkDictation(s, 'ok', true));
    expect(dictationDone(s)).toBe(true);
    expect(dictationScore(s)).toBe(2);
    const wrongTwice = nextDictation(checkDictation(nextDictation(checkDictation(startDictation(['a']), 'bad', false)), 'bad', false));
    expect(dictationDone(wrongTwice)).toBe(true);
    expect(dictationScore(wrongTwice)).toBe(0);
  });

  it('a lone wrong word comes back as a new turn (so the read-aloud runs again)', () => {
    const s = nextDictation(checkDictation(startDictation(['a']), 'bad', false));
    expect(s.queue).toEqual(['a']);
    expect(s.turn).toBe(1);
  });

  it('Check twice, or Next before Check, changes nothing', () => {
    const s = checkDictation(startDictation(IDS), 'x', false);
    expect(checkDictation(s, 'y', true)).toBe(s);
    expect(nextDictation(startDictation(IDS))).toEqual(startDictation(IDS));
  });
});

describe('the word', () => {
  it('Spanish: the article is spoken, the English is the meaning', () => {
    expect(dictationWord(item('la camisa', 'shirt'), 'es')).toEqual({ answer: 'la camisa', say: 'la camisa', meaning: 'shirt' });
  });
  it('speaks the first of the alternatives, without a slash', () => {
    expect(dictationWord(item('el carro / el coche', 'car'), 'es').say).toBe('el carro');
  });
  it('English direction: the English word is typed, the Spanish is the meaning', () => {
    expect(dictationWord(item('la camisa', 'shirt'), 'en')).toEqual({ answer: 'shirt', say: 'shirt', meaning: 'la camisa' });
  });
});

describe('grading (the Words tab typing)', () => {
  it('exact, any case and any accepted alternative are right; empty and a typo are wrong', () => {
    expect(isDictationRight('La Camisa', 'la camisa', false)).toBe(true);
    expect(isDictationRight('el coche', 'el carro / el coche', false)).toBe(true);
    expect(isDictationRight('', 'la camisa', false)).toBe(false);
    expect(isDictationRight('la camica', 'la camisa', false)).toBe(false);
  });
  it('a missing accent is right unless the accent switch is on', () => {
    expect(isDictationRight('el cafe', 'el café', false)).toBe(true);
    expect(isDictationRight('el cafe', 'el café', true)).toBe(false);
    expect(isDictationRight('el café', 'el café', true)).toBe(true);
  });
});

describe('parseDictation', () => {
  const good = { queue: ['b', 'c'], retried: ['a'], firstTry: ['b'], turn: 2, checked: null };
  it('takes a state that fits the ids', () => {
    expect(parseDictation(good, IDS)).toEqual(good);
    expect(parseDictation({ ...good, checked: { typed: 'x', right: false } }, IDS)?.checked).toEqual({ typed: 'x', right: false });
  });
  it('refuses a broken or foreign one', () => {
    expect(parseDictation(null, IDS)).toBeNull();
    expect(parseDictation('x', IDS)).toBeNull();
    expect(parseDictation({ ...good, queue: ['b', 'zzz'] }, IDS)).toBeNull();
    expect(parseDictation({ ...good, queue: ['b', 'b'] }, IDS)).toBeNull();
    expect(parseDictation({ ...good, turn: -1 }, IDS)).toBeNull();
    expect(parseDictation({ ...good, turn: 1.5 }, IDS)).toBeNull();
    expect(parseDictation({ ...good, checked: { typed: 1, right: true } }, IDS)).toBeNull();
    expect(parseDictation({ ...good, queue: [], checked: { typed: 'x', right: true } }, IDS)).toBeNull();
    expect(parseDictation({ queue: ['a'] }, IDS)).toBeNull();
  });
});
