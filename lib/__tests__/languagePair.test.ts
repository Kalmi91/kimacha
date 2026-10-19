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
