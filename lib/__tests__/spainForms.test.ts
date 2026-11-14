import { isSpainForm, spainFormsInAnswer, spainFormsInSentence, spainFormsInCardSentence } from '../spainForms';

describe('Spain forms', () => {
  it('normalizes articles, case, whitespace and accepted alternatives without matching substrings', () => {
    expect(isSpainForm('  LA   AZAFATA  ')).toBe(true);
    expect(spainFormsInAnswer('la aeromoza / la azafata')).toEqual(['azafata']);
    expect(spainFormsInAnswer('el grifo / el grifo')).toEqual(['grifo']);
    expect(isSpainForm('el grifo grande')).toBe(false);
    for (const form of ['', 'la aeromoza', 'descomponerse', 'pequeño', 'bonito', 'trabajo', 'el coche']) {
      expect(isSpainForm(form)).toBe(false);
    }
  });

  it('uses sentence lemmas for conjugation and supplements incomplete or stale lemmas', () => {
    expect(spainFormsInSentence('Se estropeó ayer.', ['se', 'estropearse', 'ayer'])).toEqual(['estropearse']);
    expect(spainFormsInSentence('Se estropeó ayer.', ['se', 'descomponerse', 'ayer'])).toEqual(['estropearse']);
    expect(spainFormsInSentence('Una azafata llegó.', ['un', 'aeromoza', 'llegar'])).toEqual(['azafata']);
    expect(spainFormsInSentence('La máquina se estropeara.', ['el', 'máquina', 'se', 'estropear'])).toEqual(['estropearse']);
    expect(spainFormsInSentence('', ['azafata'])).toEqual([]);
  });

  it('matches inflected tokens with punctuation when no lemmas are available', () => {
    expect(spainFormsInSentence('¡AZAFATAS! Los grifos y escaparates.')).toEqual(['azafata', 'escaparate', 'grifo']);
    for (const sentence of ['Se estropean.', 'Se estropeaba.', 'Se estropearán.', 'Se estropearían.', 'Que se estropee.', 'Se ha estropeado.', 'Están estropeadas.', 'Sigue estropeando.', 'Si se estropeara.', 'Os estropeáis.', 'Sigue estropeándose.', 'Puedes estropearlo.']) {
      expect(spainFormsInSentence(sentence)).toEqual(['estropearse']);
    }
    expect(spainFormsInSentence('Puede estropearse.')).toEqual(['estropearse']);
    expect(spainFormsInSentence('Las coletas y los flequillos.')).toEqual(['coleta', 'flequillo']);
    expect(spainFormsInSentence('El refrigerador se descompuso.')).toEqual([]);
    expect(spainFormsInSentence('Aeromozas, flecos, llaves y aparadores.')).toEqual([]);
    expect(spainFormsInSentence('grifonado, azafatazo, escaparatero')).toEqual([]);
    expect(spainFormsInSentence('123 ...')).toEqual([]);
  });

  it('recovers words-open annotations by ID and never applies them to another sentence', () => {
    expect(spainFormsInCardSentence({ id: 'o4216', exampleEs: 'Una azafata me dio agua y un dulce en el avión.' })).toEqual(['azafata']);
    expect(spainFormsInCardSentence({ id: 'o4666', exampleEs: 'El refrigerador se estropeó y hay que arreglarlo.' })).toEqual(['estropearse']);
    expect(spainFormsInCardSentence({ id: 'o4216' }, 'Una aeromoza llegó.')).toEqual([]);
    expect(spainFormsInCardSentence({ id: 'e1', exampleEs: 'El grifo gotea.' })).toEqual(['grifo']);
    expect(spainFormsInCardSentence({ id: 'missing' })).toEqual([]);
  });
});
