import fs from 'fs';
import path from 'path';
import forms from '../words-open/spain-forms.json';
import b1 from '../words-open/b1.json';
import { gradePcicAnswer, pcicAlternatives } from '@/lib/pcicMatch';
import { isSpainForm, spainFormsInSentence, spainFormsInCardSentence } from '@/lib/spainForms';

const root = path.join(__dirname, '..');
const stripArticle = (text: string) => text.normalize('NFC').toLowerCase().trim().replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '').replace(/\s+/g, ' ');
const corpus = ['words-open', 'words/en'].flatMap(deck =>
  fs.readdirSync(path.join(root, deck)).filter(file => file.endsWith('.json')).flatMap(file => {
    const data = JSON.parse(fs.readFileSync(path.join(root, deck, file), 'utf8'));
    return Array.isArray(data) ? data.filter((card: { es?: string }) => typeof card.es === 'string') : [];
  })
);
const alternatives = new Set(corpus.flatMap((card: { es: string }) => pcicAlternatives(card.es).map(stripArticle)));

describe('Spain-form data integrity', () => {
  it('contains unique lowercase dictionary forms attested as corpus alternatives, each with a Mexican equivalent and a reason', () => {
    expect(forms.length).toBeGreaterThan(0);
    expect(new Set(forms.map(entry => entry.form)).size).toBe(forms.length);
    for (const entry of forms) {
      expect(entry.form).toBe(stripArticle(entry.form));
      expect(alternatives.has(entry.form)).toBe(true);
      expect(entry.mx.trim().length).toBeGreaterThan(0);
      expect(entry.reason.trim()).toMatch(/\.$/);
    }
  });

  it.each([4216, 4666])('card #%s reveals its Mexican form on an empty answer, keeps the Spain form as a labelled alternative, and its sentence is Mexican', order => {
    const card = b1.find(entry => entry.order === order)!;
    expect(card).toBeDefined();
    const grade = gradePcicAnswer('', card.es, false, 'es');
    expect(isSpainForm(grade.best)).toBe(false);
    expect(pcicAlternatives(card.es).some(alt => isSpainForm(alt))).toBe(true);
    expect(spainFormsInSentence(card.sentence_es, card.sentence_lemmas)).toEqual([]);
    expect(spainFormsInCardSentence({ id: `o${order}`, exampleEs: card.sentence_es })).toEqual([]);
  });

  it('never reveals a Spain-only form on an empty answer while the card has a Mexican alternative', () => {
    const shownSpain = corpus
      .filter((card: { es: string }) => pcicAlternatives(card.es).some(alt => !isSpainForm(alt)))
      .filter((card: { es: string }) => isSpainForm(gradePcicAnswer('', card.es, false, 'es').best));
    expect(shownSpain).toEqual([]);
  });

  it('does not mislabel the Mexican equivalents or shared everyday alternatives', () => {
    for (const word of [...forms.map(entry => entry.mx), 'pequeño', 'chico', 'bonito', 'lindo', 'trabajo', 'chamba', 'coche', 'vale', 'piso']) {
      expect(isSpainForm(word)).toBe(false);
    }
  });
});
