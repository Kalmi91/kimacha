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

  it('stays silent on ordinary cards', () => {
    expect(cardNote({ es: 'la casa', en: 'the house' }, 'hu', 'es', 'La casa es grande.')).toBeNull();
  });

  it('only applies the Spanish rules to a Spanish target', () => {
    expect(cardNote({ es: 'el pantalón', en: 'the trousers' }, 'hu', 'en')).toBeNull();
  });
});
