// (conjugation-slot). The forms are FACTS (the spec's own
// words): this suite spot-checks every one of the 15 hand-tabled irregulars
// across all 6 tenses, the regular rule generator (including the
// -car/-gar/-zar spelling rule and the creer/leer vowel-stem preterite), and
// that genuinely risky verbs (stem-changing, accent-shifting, 1st-person-only
// irregulars) are excluded rather than mis-conjugated.

import {
  conjugate,
  conjugateRegular,
  formFor,
  IRREGULAR_INFINITIVES,
  TENSES,
  type Tense,
} from '../conjugate';

const ALL_TENSES: Tense[] = ['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo_presente'];

describe('conjugate: the 15 core irregulars', () => {
  it('ser: all 6 tenses, all 5 persons', () => {
    expect(conjugate('ser', 'presente')!.map((f) => f.form)).toEqual(['soy', 'eres', 'es', 'somos', 'son']);
    expect(conjugate('ser', 'indefinido')!.map((f) => f.form)).toEqual(['fui', 'fuiste', 'fue', 'fuimos', 'fueron']);
    expect(conjugate('ser', 'imperfecto')!.map((f) => f.form)).toEqual(['era', 'eras', 'era', 'éramos', 'eran']);
    expect(conjugate('ser', 'futuro')!.map((f) => f.form)).toEqual(['seré', 'serás', 'será', 'seremos', 'serán']);
    expect(conjugate('ser', 'condicional')!.map((f) => f.form)).toEqual(['sería', 'serías', 'sería', 'seríamos', 'serían']);
    expect(conjugate('ser', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['sea', 'seas', 'sea', 'seamos', 'sean']);
  });

  it('estar: all 6 tenses', () => {
    expect(conjugate('estar', 'presente')!.map((f) => f.form)).toEqual(['estoy', 'estás', 'está', 'estamos', 'están']);
    expect(conjugate('estar', 'indefinido')!.map((f) => f.form)).toEqual(['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron']);
    expect(conjugate('estar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['esté', 'estés', 'esté', 'estemos', 'estén']);
  });

  it('ir: shares fui/fuiste/fue/fuimos/fueron with ser in indefinido, but not elsewhere', () => {
    expect(conjugate('ir', 'presente')!.map((f) => f.form)).toEqual(['voy', 'vas', 'va', 'vamos', 'van']);
    expect(conjugate('ir', 'indefinido')!.map((f) => f.form)).toEqual(['fui', 'fuiste', 'fue', 'fuimos', 'fueron']);
    expect(conjugate('ir', 'imperfecto')!.map((f) => f.form)).toEqual(['iba', 'ibas', 'iba', 'íbamos', 'iban']);
    expect(conjugate('ir', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['vaya', 'vayas', 'vaya', 'vayamos', 'vayan']);
  });

  it('tener: irregular futuro/condicional stem (tendr-)', () => {
    expect(conjugate('tener', 'presente')!.map((f) => f.form)).toEqual(['tengo', 'tienes', 'tiene', 'tenemos', 'tienen']);
    expect(conjugate('tener', 'futuro')!.map((f) => f.form)).toEqual(['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendrán']);
    expect(conjugate('tener', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['tenga', 'tengas', 'tenga', 'tengamos', 'tengan']);
  });

  it('hacer: irregular futuro stem (har-), irregular preterite (hice/hizo)', () => {
    expect(conjugate('hacer', 'presente')!.map((f) => f.form)).toEqual(['hago', 'haces', 'hace', 'hacemos', 'hacen']);
    expect(conjugate('hacer', 'indefinido')!.map((f) => f.form)).toEqual(['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron']);
    expect(conjugate('hacer', 'futuro')!.map((f) => f.form)).toEqual(['haré', 'harás', 'hará', 'haremos', 'harán']);
  });

  it('poder: subjuntivo keeps unstressed o in nosotros (podamos, not puedamos)', () => {
    expect(conjugate('poder', 'presente')!.map((f) => f.form)).toEqual(['puedo', 'puedes', 'puede', 'podemos', 'pueden']);
    expect(conjugate('poder', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['pueda', 'puedas', 'pueda', 'podamos', 'puedan']);
    expect(conjugate('poder', 'futuro')!.map((f) => f.form)).toEqual(['podré', 'podrás', 'podrá', 'podremos', 'podrán']);
  });

  it('decir: irregular yo (digo), irregular preterite (dije), irregular futuro (dir-)', () => {
    expect(conjugate('decir', 'presente')!.map((f) => f.form)).toEqual(['digo', 'dices', 'dice', 'decimos', 'dicen']);
    expect(conjugate('decir', 'indefinido')!.map((f) => f.form)).toEqual(['dije', 'dijiste', 'dijo', 'dijimos', 'dijeron']);
    expect(conjugate('decir', 'futuro')!.map((f) => f.form)).toEqual(['diré', 'dirás', 'dirá', 'diremos', 'dirán']);
  });

  it('ver: keeps the "e" in imperfecto (veía, not vía)', () => {
    expect(conjugate('ver', 'presente')!.map((f) => f.form)).toEqual(['veo', 'ves', 've', 'vemos', 'ven']);
    expect(conjugate('ver', 'imperfecto')!.map((f) => f.form)).toEqual(['veía', 'veías', 'veía', 'veíamos', 'veían']);
    expect(conjugate('ver', 'futuro')!.map((f) => f.form)).toEqual(['veré', 'verás', 'verá', 'veremos', 'verán']); // regular futuro
  });

  it('dar: subjuntivo carries the written accent (dé, not de)', () => {
    expect(conjugate('dar', 'presente')!.map((f) => f.form)).toEqual(['doy', 'das', 'da', 'damos', 'dan']);
    expect(conjugate('dar', 'indefinido')!.map((f) => f.form)).toEqual(['di', 'diste', 'dio', 'dimos', 'dieron']);
    expect(conjugate('dar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['dé', 'des', 'dé', 'demos', 'den']);
  });

  it('saber: irregular yo (sé), irregular preterite (supe), irregular futuro (sabr-)', () => {
    expect(conjugate('saber', 'presente')!.map((f) => f.form)).toEqual(['sé', 'sabes', 'sabe', 'sabemos', 'saben']);
    expect(conjugate('saber', 'indefinido')!.map((f) => f.form)).toEqual(['supe', 'supiste', 'supo', 'supimos', 'supieron']);
    expect(conjugate('saber', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['sepa', 'sepas', 'sepa', 'sepamos', 'sepan']);
  });

  it('querer: irregular futuro (querr-), irregular preterite (quise)', () => {
    expect(conjugate('querer', 'presente')!.map((f) => f.form)).toEqual(['quiero', 'quieres', 'quiere', 'queremos', 'quieren']);
    expect(conjugate('querer', 'futuro')!.map((f) => f.form)).toEqual(['querré', 'querrás', 'querrá', 'querremos', 'querrán']);
  });

  it('venir: irregular futuro (vendr-), irregular preterite (vine)', () => {
    expect(conjugate('venir', 'presente')!.map((f) => f.form)).toEqual(['vengo', 'vienes', 'viene', 'venimos', 'vienen']);
    expect(conjugate('venir', 'indefinido')!.map((f) => f.form)).toEqual(['vine', 'viniste', 'vino', 'vinimos', 'vinieron']);
    expect(conjugate('venir', 'futuro')!.map((f) => f.form)).toEqual(['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendrán']);
  });

  it('poner: irregular futuro (pondr-), irregular preterite (puse)', () => {
    expect(conjugate('poner', 'presente')!.map((f) => f.form)).toEqual(['pongo', 'pones', 'pone', 'ponemos', 'ponen']);
    expect(conjugate('poner', 'futuro')!.map((f) => f.form)).toEqual(['pondré', 'pondrás', 'pondrá', 'pondremos', 'pondrán']);
  });

  it('salir: REGULAR preterite (salí), irregular futuro (saldr-)', () => {
    expect(conjugate('salir', 'presente')!.map((f) => f.form)).toEqual(['salgo', 'sales', 'sale', 'salimos', 'salen']);
    expect(conjugate('salir', 'indefinido')!.map((f) => f.form)).toEqual(['salí', 'saliste', 'salió', 'salimos', 'salieron']);
    expect(conjugate('salir', 'futuro')!.map((f) => f.form)).toEqual(['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldrán']);
  });

  it('haber: full personal paradigm (he/has/ha/hemos/han)', () => {
    expect(conjugate('haber', 'presente')!.map((f) => f.form)).toEqual(['he', 'has', 'ha', 'hemos', 'han']);
    expect(conjugate('haber', 'futuro')!.map((f) => f.form)).toEqual(['habré', 'habrás', 'habrá', 'habremos', 'habrán']);
    expect(conjugate('haber', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['haya', 'hayas', 'haya', 'hayamos', 'hayan']);
  });

  it('every one of the 15 spec-named irregulars is in IRREGULAR_INFINITIVES', () => {
    const expected = [
      'ser', 'estar', 'ir', 'tener', 'hacer', 'poder', 'decir', 'ver', 'dar',
      'saber', 'querer', 'venir', 'poner', 'salir', 'haber',
    ];
    expect(expected).toHaveLength(15);
    for (const v of expected) expect(IRREGULAR_INFINITIVES.has(v)).toBe(true);
    expect(IRREGULAR_INFINITIVES.size).toBe(15);
  });

  it('every irregular verb conjugates in all 6 tenses with no null and no missing person', () => {
    for (const inf of IRREGULAR_INFINITIVES) {
      for (const tense of ALL_TENSES) {
        const forms = conjugate(inf, tense);
        expect(forms).not.toBeNull();
        expect(forms).toHaveLength(5);
        for (const f of forms!) expect(f.form.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('conjugate: regular verbs, rule-generated', () => {
  it('hablar (-ar) presente/imperfecto/futuro/condicional/subjuntivo', () => {
    expect(conjugate('hablar', 'presente')!.map((f) => f.form)).toEqual(['hablo', 'hablas', 'habla', 'hablamos', 'hablan']);
    expect(conjugate('hablar', 'imperfecto')!.map((f) => f.form)).toEqual(['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablaban']);
    expect(conjugate('hablar', 'futuro')!.map((f) => f.form)).toEqual(['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablarán']);
    expect(conjugate('hablar', 'condicional')!.map((f) => f.form)).toEqual(['hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablarían']);
    expect(conjugate('hablar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['hable', 'hables', 'hable', 'hablemos', 'hablen']);
    expect(conjugate('hablar', 'indefinido')!.map((f) => f.form)).toEqual(['hablé', 'hablaste', 'habló', 'hablamos', 'hablaron']);
  });

  it('comer (-er) presente/indefinido', () => {
    expect(conjugate('comer', 'presente')!.map((f) => f.form)).toEqual(['como', 'comes', 'come', 'comemos', 'comen']);
    expect(conjugate('comer', 'indefinido')!.map((f) => f.form)).toEqual(['comí', 'comiste', 'comió', 'comimos', 'comieron']);
    expect(conjugate('comer', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['coma', 'comas', 'coma', 'comamos', 'coman']);
  });

  it('vivir (-ir) presente/indefinido', () => {
    expect(conjugate('vivir', 'presente')!.map((f) => f.form)).toEqual(['vivo', 'vives', 'vive', 'vivimos', 'viven']);
    expect(conjugate('vivir', 'indefinido')!.map((f) => f.form)).toEqual(['viví', 'viviste', 'vivió', 'vivimos', 'vivieron']);
  });

  it('-car/-gar/-zar spelling rule: indefinido yo form only', () => {
    expect(formFor('buscar', 'indefinido', 'yo')).toBe('busqué');
    expect(formFor('buscar', 'indefinido', 'tu')).toBe('buscaste'); // unaffected persons stay plain
    expect(formFor('llegar', 'indefinido', 'yo')).toBe('llegué');
    expect(formFor('cruzar', 'indefinido', 'yo')).toBe('crucé');
  });

  it('-car/-gar/-zar spelling rule: subjuntivo_presente applies to the WHOLE paradigm', () => {
    expect(conjugate('buscar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['busque', 'busques', 'busque', 'busquemos', 'busquen']);
    expect(conjugate('llegar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['llegue', 'llegues', 'llegue', 'lleguemos', 'lleguen']);
    expect(conjugate('cruzar', 'subjuntivo_presente')!.map((f) => f.form)).toEqual(['cruce', 'cruces', 'cruce', 'crucemos', 'crucen']);
  });

  it('creer/leer: vowel-stem preterite (accent on í, y-insertion in 3rd persons)', () => {
    expect(conjugate('creer', 'indefinido')!.map((f) => f.form)).toEqual(['creí', 'creíste', 'creyó', 'creímos', 'creyeron']);
    expect(conjugate('leer', 'indefinido')!.map((f) => f.form)).toEqual(['leí', 'leíste', 'leyó', 'leímos', 'leyeron']);
    // presente and imperfecto are fully regular for these verbs (no y-insertion there)
    expect(conjugate('creer', 'presente')!.map((f) => f.form)).toEqual(['creo', 'crees', 'cree', 'creemos', 'creen']);
    expect(conjugate('creer', 'imperfecto')!.map((f) => f.form)).toEqual(['creía', 'creías', 'creía', 'creíamos', 'creían']);
  });

  it('futuro/condicional attach to the FULL infinitive for all 3 classes', () => {
    expect(formFor('comer', 'futuro', 'yo')).toBe('comeré');
    expect(formFor('vivir', 'condicional', 'nosotros')).toBe('viviríamos');
  });
});

describe('conjugate: excluded (stem-changing / risky) verbs return null, never a guess', () => {
  const risky = [
    'pensar', 'dormir', 'morir', 'encontrar', 'pedir', 'servir', 'seguir',
    'construir', 'huir', 'conducir', 'traer', 'conocer', 'andar', 'obtener',
    'confiar', 'enviar', 'continuar', 'reunir', 'jugar', 'volver', 'querer', // querer is irregular (table), not "regular-excluded", included to prove conjugateRegular alone also refuses it
  ];
  it.each(risky)('%s: conjugateRegular returns null (either irregular-tabled or excluded)', (inf) => {
    expect(conjugateRegular(inf, 'presente')).toBeNull();
  });

  it('a verb not ending in ar/er/ir returns null', () => {
    expect(conjugate('xyz', 'presente')).toBeNull();
  });

  it('a reflexive infinitive (-arse/-erse/-irse) returns null, not modeled', () => {
    expect(conjugate('llamarse', 'presente')).toBeNull();
    expect(conjugate('despertarse', 'presente')).toBeNull();
  });
});

describe('TENSES export', () => {
  it('lists exactly the 6 tenses named in GAMES.md 4.7', () => {
    expect(TENSES).toEqual(['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo_presente']);
  });
});

describe('BUG-002: verbs that used to be handed out with a wrong form', () => {
  // "almorzo/almorce", "neva", "ofreco/ofreca", "venco/venca" and "subyaco" were
  // all generated and shown as facts, because the exclusion list is a name list
  // and these names were missing from it.
  it.each(['almorzar', 'nevar', 'ofrecer', 'vencer', 'subyacer'])('%s: null in every tense', (inf) => {
    for (const tense of ALL_TENSES) expect(conjugate(inf, tense)).toBeNull();
  });

  // The shape-based guard covers the families a name list keeps missing:
  // -cer/-cir take -zco/-zo, -ger/-gir swap g→j, -uir (with -guir) inserts a y.
  it.each(['mecer', 'coger', 'dirigir', 'distinguir', 'incluir'])('%s: excluded by its ending', (inf) => {
    expect(conjugate(inf, 'presente')).toBeNull();
    expect(conjugate(inf, 'subjuntivo_presente')).toBeNull();
  });

  it('the ending guard does not swallow the hand-tabled hacer and decir', () => {
    expect(formFor('hacer', 'presente', 'yo')).toBe('hago');
    expect(formFor('decir', 'subjuntivo_presente', 'yo')).toBe('diga');
  });
});
