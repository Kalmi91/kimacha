// the inflected forms of the words-open cards (lib/esForms.ts).
import { encliticBases, formsOfCard, looseVerbForms, participleForms, subjuntivoImperfecto, vosotrosPresente } from '../esForms';
import { esFeminine, esPlural } from '../esInflect';
import { conjugate, TENSES } from '../games/conjugate';
import { findOpenWordByForm } from '../../data/openWords';

const deps = { conjugate, TENSES, esPlural, esFeminine };

describe('lib/esForms', () => {
  it('a stem-changing verb gets a wide set of forms: present, past 3rd person, gerund, past subjunctive', () => {
    const forms = looseVerbForms('dormir');
    for (const f of ['duermo', 'duermes', 'dormimos', 'durmió', 'durmieron', 'durmiendo', 'durmiera', 'durmiéramos']) {
      expect(forms).toContain(f);
    }
    expect(looseVerbForms('pedir')).toEqual(expect.arrayContaining(['pido', 'pedimos', 'pidió', 'pidiendo']));
    expect(looseVerbForms('jugar')).toEqual(expect.arrayContaining(['juego', 'jugamos', 'jugué']));
    expect(looseVerbForms('conocer')).toEqual(expect.arrayContaining(['conozco', 'conocemos']));
    expect(looseVerbForms('seguir')).toEqual(expect.arrayContaining(['sigo', 'sigues', 'siguió']));
    expect(looseVerbForms('ir')).toEqual([]);
  });

  it('the participles: regular, irregular and extended, in gender and number', () => {
    expect(participleForms('hablar')).toEqual(['hablado', 'hablada', 'hablados', 'habladas']);
    expect(participleForms('leer')).toContain('leído');
    expect(participleForms('recibir')).toContain('recibida');
    expect(participleForms('romper')).toEqual(expect.arrayContaining(['roto', 'rota', 'rotos', 'rotas']));
    expect(participleForms('abrir')).toContain('abierto');
    expect(participleForms('describir')).toContain('descrito');
    expect(participleForms('devolver')).toContain('devuelto');
    expect(participleForms('resolver')).toContain('resuelto');
    expect(participleForms('hacer')).toContain('hecha');
    expect(participleForms('ver')).toContain('visto');
  });

  it('the past subjunctive from the 3rd person plural past, with an accent in the nosotros form', () => {
    expect(subjuntivoImperfecto('tuvieron')).toEqual(['tuviera', 'tuvieras', 'tuvieran', 'tuviéramos']);
    expect(subjuntivoImperfecto('fueron')).toContain('fuéramos');
    expect(subjuntivoImperfecto('hablaron')).toContain('habláramos');
    expect(subjuntivoImperfecto('hablar')).toEqual([]);
  });

  it('formsOfCard: the forms of an engine verb, the past subjunctive and the participle, the plural of a noun, the gender form of an adjective', () => {
    const tener = formsOfCard('tener', 'verb', deps);
    expect(tener).toEqual(expect.arrayContaining(['tengo', 'tuvieron', 'tuviera', 'tuviéramos', 'teniendo', 'tenido']));
    expect(formsOfCard('el abuelo', 'noun', deps)).toEqual(['abuelos']);
    expect(formsOfCard('blanco', 'adj', deps)).toEqual(['blancos', 'blanca', 'blancas']);
    expect(formsOfCard('dormir', 'verb', deps)).toContain('duermo');
    expect(formsOfCard('un / una', 'det', deps)).toEqual([]);
    expect(formsOfCard('levantarse', 'verb', deps)).toEqual(expect.arrayContaining(['levanto', 'levantó', 'levantaba', 'levantado']));
    expect(formsOfCard('acordarse', 'verb', deps)).toEqual(expect.arrayContaining(['acuerdo', 'acuerdas', 'acordamos']));
    expect(formsOfCard('caber', 'verb', deps)).toEqual(expect.arrayContaining(['cabe', 'caben']));
    expect(formsOfCard('despertarse', 'verb', deps)).toEqual(expect.arrayContaining(['despierto', 'despiertan', 'despertamos']));
    expect(formsOfCard('rentar / alquilar', 'verb', deps)).toEqual(expect.arrayContaining(['rento', 'alquilan']));
  });

  it('the vosotros present form from the infinitive, the irregulars from a table', () => {
    expect(vosotrosPresente('hablar')).toEqual(['habláis']);
    expect(vosotrosPresente('tener')).toEqual(['tenéis']);
    expect(vosotrosPresente('vivir')).toEqual(['vivís']);
    expect(vosotrosPresente('ir')).toEqual(['vais']);
    expect(formsOfCard('ser', 'verb', deps)).toContain('sois');
  });

  it('a pronoun attached to the verb can be cut off (at least 3 letters remain)', () => {
    expect(encliticBases('verlo')).toContain('ver');
    expect(encliticBases('ayudame')).toContain('ayuda');
    expect(encliticBases('vela')).toEqual([]);
  });

  it('the gloss index ties the forms of stem-changing verbs, the participle and a pronoun attached to the verb to the lemma', () => {
    expect(findOpenWordByForm('duermo')?.lemma).toBe('dormir');
    expect(findOpenWordByForm('dormimos')?.lemma).toBe('dormir');
    expect(findOpenWordByForm('juegan')?.lemma).toBe('jugar');
    expect(findOpenWordByForm('cerrada')?.lemma).toBe('cerrar');
    expect(findOpenWordByForm('hecha')?.lemma).toBe('hacer');
    expect(findOpenWordByForm('tuviéramos')?.lemma).toBe('tener');
    expect(findOpenWordByForm('verlo')?.lemma).toBe('ver');
    expect(findOpenWordByForm('ayúdame')?.lemma).toBe('ayudar');
    expect(findOpenWordByForm('mesa-inexistente')).toBeUndefined();
  });
});
