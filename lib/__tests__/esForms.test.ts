// a words-open kártyák ragozott alakjai (lib/esForms.ts).
import { encliticBases, formsOfCard, looseVerbForms, participleForms, subjuntivoImperfecto, vosotrosPresente } from '../esForms';
import { esFeminine, esPlural } from '../esInflect';
import { conjugate, TENSES } from '../games/conjugate';
import { findOpenWordByForm } from '../../data/openWords';

const deps = { conjugate, TENSES, esPlural, esFeminine };

describe('lib/esForms', () => {
  it('a tőhangváltó ige bő alakkészletet kap: jelen, múlt 3. szám, gerundium, kötőmód múlt', () => {
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

  it('az igenevek: szabályos, rendhagyó és toldott, nemben és számban', () => {
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

  it('a kötőmód múlt a múlt idő 3. szám többes alakjából, ékezettel a nosotros alakban', () => {
    expect(subjuntivoImperfecto('tuvieron')).toEqual(['tuviera', 'tuvieras', 'tuvieran', 'tuviéramos']);
    expect(subjuntivoImperfecto('fueron')).toContain('fuéramos');
    expect(subjuntivoImperfecto('hablaron')).toContain('habláramos');
    expect(subjuntivoImperfecto('hablar')).toEqual([]);
  });

  it('formsOfCard: a motor-ige alakjai, a kötőmód múlt és az igenév, a főnév többese, a melléknév nemi alakja', () => {
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

  it('a vosotros jelen idejű alak az infinitívből, a rendhagyók táblából', () => {
    expect(vosotrosPresente('hablar')).toEqual(['habláis']);
    expect(vosotrosPresente('tener')).toEqual(['tenéis']);
    expect(vosotrosPresente('vivir')).toEqual(['vivís']);
    expect(vosotrosPresente('ir')).toEqual(['vais']);
    expect(formsOfCard('ser', 'verb', deps)).toContain('sois');
  });

  it('az igéhez írt névmás levágható (legalább 3 betű marad)', () => {
    expect(encliticBases('verlo')).toContain('ver');
    expect(encliticBases('ayudame')).toContain('ayuda');
    expect(encliticBases('vela')).toEqual([]);
  });

  it('a glossza-index a tőhangváltó igék alakjait, az igenevet és az igéhez írt névmást is a lemmához köti', () => {
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
