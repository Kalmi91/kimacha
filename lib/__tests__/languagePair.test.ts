import { pairOf, sourceFor } from '../languagePair';

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

describe('pairOf, German pairs', () => {
  it('names the direction of the six German pairs when the source is given', () => {
    expect(pairOf('de', 'es')).toBe('es→de');
    expect(pairOf('de', 'en')).toBe('en→de');
    expect(pairOf('de', 'hu')).toBe('hu→de');
    expect(pairOf('es', 'de')).toBe('de→es');
    expect(pairOf('en', 'de')).toBe('de→en');
    expect(pairOf('hu', 'de')).toBe('de→hu');
  });

  it('a German target without a usable source is learned from English, never from itself', () => {
    expect(pairOf('de', null)).toBe('en→de');
    expect(pairOf('de', 'de')).toBe('en→de');
    expect(sourceFor('de')).toBe('en');
    expect(sourceFor('de', 'hu')).toBe('hu');
  });

  it('a German source is a usable source', () => {
    expect(sourceFor('es', 'de')).toBe('de');
    expect(sourceFor('hu', 'de')).toBe('de');
  });
});
