import { cardNote } from '@/lib/cardNotes';

describe('cardNote', () => {
  it('prefers a hand-written note in the learner language', () => {
    const note = cardNote({ es: 'la cortina', note_hu: 'magyar magyarázat' }, 'hu', 'es');
    expect(note).toEqual({ kind: 'manual', text: 'magyar magyarázat' });
  });

  it('falls back to the English note when the learner language has none', () => {
    const note = cardNote({ es: 'la cortina', note_en: 'english note' }, 'de', 'es');
    expect(note).toEqual({ kind: 'manual', text: 'english note' });
  });

  it('flags the RAE two-symmetric-parts nouns from either side', () => {
    expect(cardNote({ es: 'el pantalón', en: 'the trousers' }, 'hu', 'es')?.kind).toBe('pairNoun');
    expect(cardNote({ es: 'los vaqueros', en: 'the jeans' }, 'hu', 'es')?.kind).toBe('pairNoun');
    expect(cardNote({ es: 'las gafas', en: 'the glasses' }, 'hu', 'es')?.kind).toBe('pairNoun');
  });

  it('explains unos/unas when the sentence uses it', () => {
    const note = cardNote({ es: 'los zapatos', en: 'the shoes' }, 'hu', 'es', 'Llevo unos zapatos viejos.');
    expect(note?.kind).toBe('someIndef');
  });

  // FB85: every ser/estar card explains the difference between the two.
  it('explains ser vs estar on the copula topics', () => {
    expect(cardNote({ es: 'yo soy', topic: 'ser' }, 'hu', 'es')?.kind).toBe('serEstar');
    expect(cardNote({ es: 'ellos están', topic: 'estar' }, 'hu', 'es')?.kind).toBe('serEstar');
    expect(cardNote({ es: 'El café está frío.', topic: 'ser_vs_estar' }, 'hu', 'es')?.kind).toBe('serEstar');
    // other target languages have no Spanish copula split
    expect(cardNote({ es: 'yo soy', topic: 'ser' }, 'hu', 'en')).toBeNull();
  });

  it('stays silent on ordinary cards', () => {
    expect(cardNote({ es: 'la casa', en: 'the house' }, 'hu', 'es', 'La casa es grande.')).toBeNull();
  });

  it('only applies the Spanish rules to a Spanish target', () => {
    expect(cardNote({ es: 'el pantalón', en: 'the trousers' }, 'hu', 'en')).toBeNull();
  });
});
