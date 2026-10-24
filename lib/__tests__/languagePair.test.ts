import { pairOf } from '../languagePair';

describe('pairOf', () => {
  it('names the direction as "<source>→<target>": the prompt language, then the learned one', () => {
    expect(pairOf('es')).toBe('en→es');
    expect(pairOf('en')).toBe('es→en');
  });

  it('is always one format: two letters, an arrow, two letters', () => {
    for (const target of ['es', 'en'] as const) expect(pairOf(target)).toMatch(/^[a-z]{2}→[a-z]{2}$/);
  });
});

describe('pairOf, Hungarian pairs', () => {
  it('names the direction of the four Hungarian pairs when the source is given', () => {
    expect(pairOf('hu', 'es')).toBe('es→hu');
    expect(pairOf('hu', 'en')).toBe('en→hu');
    expect(pairOf('es', 'hu')).toBe('hu→es');
    expect(pairOf('en', 'hu')).toBe('hu→en');
  });

  it('falls back to the en/es counterpart of the target for a missing or self source', () => {
    expect(pairOf('es', null)).toBe('en→es');
    expect(pairOf('en', 'en')).toBe('es→en');
  });
});