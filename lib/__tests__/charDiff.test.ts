import { charDiff, stripTrailingPunct } from '../charDiff';

const render = (typed: string, correct: string, fold = true) =>
  charDiff(typed, correct, fold)
    .map(d => (d.missing ? `[${d.ch}]` : d.wrong ? `<${d.ch}>` : d.ch))
    .join('');

describe('charDiff', () => {
  it('marks nothing on an exact answer', () => {
    expect(charDiff('quiero', 'quiero').every(d => !d.wrong)).toBe(true);
  });

  // FB84: the dropped letter itself has to show up, not just vanish.
  it('marks a letter left out in the middle', () => {
    expect(render('we hve', 'we have')).toBe('we h[a]ve');
  });

  it('marks a letter left out at the end', () => {
    expect(render('quier', 'quiero')).toBe('quier[o]');
  });

  it('marks an extra typed letter without cascading', () => {
    expect(render('quierro', 'quiero')).toBe('quier<r>o');
  });

  it('marks a substituted letter on both sides', () => {
    expect(render('qiero', 'quiero')).toBe('q[u]iero');
  });

  it('folds case and accents by default, keeps them when told not to', () => {
    expect(charDiff('Anos', 'años', true).some(d => d.wrong)).toBe(false);
    expect(charDiff('Anos', 'años', false).some(d => d.wrong)).toBe(true);
    expect(charDiff('años', 'años', false).some(d => d.wrong)).toBe(false);
  });

  // FB98: the sentence-final punctuation is never the mistake.
  it('does not mark the missing full stop', () => {
    expect(render('Yo trabajo', 'Yo trabajo.')).toBe('Yo trabajo');
    expect(charDiff('Yo trabajo', 'Yo trabajo.').some(d => d.wrong)).toBe(false);
  });

  it('does not mark a full stop the learner added on their own', () => {
    expect(render('Yo trabajo.', 'Yo trabajo')).toBe('Yo trabajo.');
    expect(charDiff('Yo trabajo.', 'Yo trabajo').some(d => d.wrong)).toBe(false);
  });

  it('ignores the Spanish exclamation and question pairs too', () => {
    expect(charDiff('Vamos', '¡Vamos!').some(d => d.wrong)).toBe(false);
    expect(charDiff('Como estas', '¿Cómo estás?').some(d => d.wrong)).toBe(false);
  });

  it('still flags a real slip in a sentence that ends with a full stop', () => {
    expect(render('Yo trabjo.', 'Yo trabajo.')).toBe('Yo trab[a]jo.');
  });
});

// FB98: the spelling trainer grades with this, it is the only thing standing
// between a byte-for-byte comparison and a full stop counting as a mistake.
describe('stripTrailingPunct', () => {
  it('drops the closing punctuation', () => {
    expect(stripTrailingPunct('la casa.')).toBe('la casa');
    expect(stripTrailingPunct('¡vamos!')).toBe('¡vamos');
    expect(stripTrailingPunct('la casa')).toBe('la casa');
  });

  it('leaves the letters alone', () => {
    expect(stripTrailingPunct('el año')).toBe('el año');
    expect(stripTrailingPunct('')).toBe('');
  });
});

// FB132: with the difficulty switch on, the diff must paint the dropped accent
// instead of folding it away, while case stays forgiven.
describe('charDiff with accents strict (FB132)', () => {
  it('marks a missing accent as a mistake', () => {
    const d = charDiff('estas', 'estás', { accents: false });
    expect(d.some(c => c.wrong)).toBe(true);
    expect(d.map(c => c.ch).join('')).toContain('á');
  });

  it('leaves the accented answer clean', () => {
    expect(charDiff('estás', 'estás', { accents: false }).every(c => !c.wrong)).toBe(true);
  });

  it('still forgives case', () => {
    expect(charDiff('Estás', 'estás', { accents: false }).every(c => !c.wrong)).toBe(true);
  });

  it('folds accents by default, as the beginner grader does', () => {
    expect(charDiff('estas', 'estás').every(c => !c.wrong)).toBe(true);
  });
});
