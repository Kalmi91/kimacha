// Q6 (2026-11-27): one wording pair for a right / wrong answer in every UI locale: the grammar.correct text for right,
// the randomRound.wrong text for wrong. The word card, the games and the small test follow it.

import en from '../i18n/en';
import es from '../i18n/es';
import hu from '../i18n/hu';
import de from '../i18n/de';

const LOCALES = { en, es, hu, de } as const;

describe.each(Object.entries(LOCALES))('one right / wrong wording (%s)', (_name, s) => {
  it('every right label is the grammar.correct text', () => {
    expect(s.card.correct).toBe(s.grammar.correct);
    expect(s.games.correctFeedback).toBe(s.grammar.correct);
    expect(s.grammar.perfect).toBe(s.grammar.correct);
  });

  it('every wrong label is the randomRound.wrong text', () => {
    expect(s.card.wrong).toBe(s.randomRound.wrong);
    expect(s.games.wrongFeedback).toBe(s.randomRound.wrong);
    expect(s.smallTest.missTitle).toBe(s.randomRound.wrong);
  });

  it('the retype hint starts with the wrong text and keeps its try-again part', () => {
    expect(s.pcic.retype.wrong.startsWith(s.randomRound.wrong)).toBe(true);
    expect(s.pcic.retype.wrong.length).toBeGreaterThan(s.randomRound.wrong.length);
  });

  it('right differs from wrong', () => {
    expect(s.grammar.correct).not.toBe(s.randomRound.wrong);
  });
});

it('English is exactly "Correct" and "Not quite"', () => {
  expect(en.grammar.correct).toBe('Correct');
  expect(en.randomRound.wrong).toBe('Not quite');
});
