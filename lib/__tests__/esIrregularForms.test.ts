import { getOpenWords } from '@/data/openWords';
import { irregularForms, type IrregularTense } from '../esIrregularForms';
import { conjugate, IRREGULAR_INFINITIVES } from '../games/conjugate';

function forms(inf: string, tense: IrregularTense): string[] {
  return irregularForms(inf, tense);
}

describe('stem changes', () => {
  it('e → ie in the stressed forms only (pensar, empezar, entender)', () => {
    expect(forms('pensar', 'presente')).toEqual(['pienso', 'piensas', 'piensa', 'pensamos', 'piensan']);
    expect(forms('pensar', 'imperfecto')).toContain('pensaba');
    expect(forms('pensar', 'indefinido')).toEqual(['pensé', 'pensaste', 'pensó', 'pensamos', 'pensaron']);
    expect(forms('pensar', 'subjuntivo_presente')).toEqual(['piense', 'pienses', 'piense', 'pensemos', 'piensen']);
    expect(forms('entender', 'presente')).toContain('entiendo');
    expect(forms('entender', 'indefinido')).toContain('entendió');
  });

  it('o → ue (encontrar, volver, mostrar, oler with h-)', () => {
    expect(forms('encontrar', 'presente')).toEqual(['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encuentran']);
    expect(forms('encontrar', 'indefinido')).toContain('encontré');
    expect(forms('volver', 'indefinido')).toEqual(['volví', 'volviste', 'volvió', 'volvimos', 'volvieron']);
    expect(forms('volver', 'presente')).toContain('vuelvo');
    expect(forms('volver', 'subjuntivo_presente')).toEqual(['vuelva', 'vuelvas', 'vuelva', 'volvamos', 'vuelvan']);
    expect(forms('mostrar', 'indefinido')).toContain('mostré');
    expect(forms('oler', 'presente')).toEqual(['huelo', 'hueles', 'huele', 'olemos', 'huelen']);
  });

  it('jugar: u → ue, and g → gu before e', () => {
    expect(forms('jugar', 'presente')).toEqual(['juego', 'juegas', 'juega', 'jugamos', 'juegan']);
    expect(forms('jugar', 'indefinido')).toEqual(['jugué', 'jugaste', 'jugó', 'jugamos', 'jugaron']);
    expect(forms('jugar', 'subjuntivo_presente')).toEqual(['juegue', 'juegues', 'juegue', 'juguemos', 'jueguen']);
  });

  it('-ir verbs: e → ie / o → ue, and e → i / o → u where the stress is off', () => {
    expect(forms('sentir', 'presente')).toEqual(['siento', 'sientes', 'siente', 'sentimos', 'sienten']);
    expect(forms('sentir', 'indefinido')).toEqual(['sentí', 'sentiste', 'sintió', 'sentimos', 'sintieron']);
    expect(forms('sentir', 'subjuntivo_presente')).toEqual(['sienta', 'sientas', 'sienta', 'sintamos', 'sientan']);
    expect(forms('sentir', 'subjuntivo_imperfecto')).toEqual(['sintiera', 'sintieras', 'sintiera', 'sintiéramos', 'sintieran']);
    expect(forms('dormir', 'presente')).toEqual(['duermo', 'duermes', 'duerme', 'dormimos', 'duermen']);
    expect(forms('dormir', 'indefinido')).toEqual(['dormí', 'dormiste', 'durmió', 'dormimos', 'durmieron']);
    expect(forms('dormir', 'imperfecto')).toContain('dormía');
    expect(forms('dormir', 'subjuntivo_presente')).toContain('durmamos');
    expect(forms('morir', 'indefinido')).toContain('murió');
  });

  it('e → i in every -ir stem (pedir, seguir, elegir, corregir, teñir)', () => {
    expect(forms('pedir', 'presente')).toEqual(['pido', 'pides', 'pide', 'pedimos', 'piden']);
    expect(forms('pedir', 'indefinido')).toEqual(['pedí', 'pediste', 'pidió', 'pedimos', 'pidieron']);
    expect(forms('pedir', 'subjuntivo_presente')).toContain('pidamos');
    expect(forms('seguir', 'presente')).toEqual(['sigo', 'sigues', 'sigue', 'seguimos', 'siguen']);
    expect(forms('seguir', 'subjuntivo_presente')).toEqual(['siga', 'sigas', 'siga', 'sigamos', 'sigan']);
    expect(forms('elegir', 'presente')).toEqual(['elijo', 'eliges', 'elige', 'elegimos', 'eligen']);
    expect(forms('corregir', 'presente')).toContain('corrijo');
    expect(forms('corregir', 'indefinido')).toContain('corrigieron');
    expect(forms('teñir', 'indefinido')).toEqual(['teñí', 'teñiste', 'tiñó', 'teñimos', 'tiñeron']);
  });
});

describe('spelling changes', () => {
  it('-cer / -cir: -zco after a vowel, -zo after a consonant', () => {
    expect(forms('conocer', 'presente')).toEqual(['conozco', 'conoces', 'conoce', 'conocemos', 'conocen']);
    expect(forms('conocer', 'subjuntivo_presente')).toEqual(['conozca', 'conozcas', 'conozca', 'conozcamos', 'conozcan']);
    expect(forms('aparecer', 'indefinido')).toContain('apareció');
    expect(forms('nacer', 'indefinido')).toContain('nació');
    expect(forms('vencer', 'presente')).toContain('venzo');
    expect(forms('ejercer', 'presente')).toContain('ejerzo');
    expect(forms('cocer', 'presente')).toContain('cuezo');
    expect(forms('torcer', 'presente')).toContain('tuerzo');
  });

  it('-ger / -gir: g → j before o and a; -guir: gu → g', () => {
    expect(forms('recoger', 'presente')).toEqual(['recojo', 'recoges', 'recoge', 'recogemos', 'recogen']);
    expect(forms('proteger', 'subjuntivo_presente')).toEqual(['proteja', 'protejas', 'proteja', 'protejamos', 'protejan']);
    expect(forms('dirigir', 'presente')).toContain('dirijo');
    expect(forms('exigir', 'presente')).toContain('exijo');
    expect(forms('distinguir', 'presente')).toEqual(['distingo', 'distingues', 'distingue', 'distinguimos', 'distinguen']);
  });

  it('-uir: y before a, e, o', () => {
    expect(forms('construir', 'presente')).toEqual(['construyo', 'construyes', 'construye', 'construimos', 'construyen']);
    expect(forms('construir', 'indefinido')).toEqual(['construí', 'construiste', 'construyó', 'construimos', 'construyeron']);
    expect(forms('construir', 'subjuntivo_presente')).toContain('construyamos');
    expect(forms('construir', 'subjuntivo_imperfecto')).toContain('construyéramos');
    expect(forms('construir', 'futuro')).toContain('construiré');
    expect(forms('huir', 'presente')).toContain('huyo');
    expect(forms('huir', 'indefinido')).toContain('huyó');
  });

  it('the accent moves in the stressed forms (enviar, actuar, reunir, prohibir, aislar)', () => {
    expect(forms('enviar', 'presente')).toEqual(['envío', 'envías', 'envía', 'enviamos', 'envían']);
    expect(forms('enviar', 'indefinido')).toEqual(['envié', 'enviaste', 'envió', 'enviamos', 'enviaron']);
    expect(forms('enviar', 'subjuntivo_presente')).toEqual(['envíe', 'envíes', 'envíe', 'enviemos', 'envíen']);
    expect(forms('actuar', 'presente')).toContain('actúo');
    expect(forms('reunir', 'presente')).toEqual(['reúno', 'reúnes', 'reúne', 'reunimos', 'reúnen']);
    expect(forms('prohibir', 'presente')).toContain('prohíbe');
    expect(forms('aislar', 'presente')).toContain('aíslan');
  });

  it('averiguar takes the diaeresis before e', () => {
    expect(forms('averiguar', 'indefinido')[0]).toBe('averigüé');
    expect(forms('averiguar', 'subjuntivo_presente')).toContain('averigüemos');
    expect(forms('averiguar', 'presente')).toContain('averiguo');
  });
});

describe('irregular indefinido stems and the subjuntivo imperfecto', () => {
  it('compounds of tener / venir / poner / decir / hacer', () => {
    expect(forms('obtener', 'presente')).toEqual(['obtengo', 'obtienes', 'obtiene', 'obtenemos', 'obtienen']);
    expect(forms('obtener', 'indefinido')).toEqual(['obtuve', 'obtuviste', 'obtuvo', 'obtuvimos', 'obtuvieron']);
    expect(forms('obtener', 'futuro')).toContain('obtendré');
    expect(forms('obtener', 'condicional')).toContain('obtendría');
    expect(forms('obtener', 'subjuntivo_presente')).toContain('obtengamos');
    expect(forms('obtener', 'subjuntivo_imperfecto')).toContain('obtuviéramos');
    expect(forms('prevenir', 'indefinido')).toEqual(['previne', 'previniste', 'previno', 'previnimos', 'previnieron']);
    expect(forms('prevenir', 'futuro')).toContain('prevendré');
    expect(forms('proponer', 'presente')).toContain('propongo');
    expect(forms('proponer', 'indefinido')).toEqual(['propuse', 'propusiste', 'propuso', 'propusimos', 'propusieron']);
    expect(forms('proponer', 'subjuntivo_imperfecto')).toContain('propusiera');
    expect(forms('deshacer', 'indefinido')).toEqual(['deshice', 'deshiciste', 'deshizo', 'deshicimos', 'deshicieron']);
    expect(forms('deshacer', 'futuro')).toContain('desharé');
    expect(forms('satisfacer', 'presente')).toContain('satisfago');
    expect(forms('predecir', 'indefinido')).toEqual(['predije', 'predijiste', 'predijo', 'predijimos', 'predijeron']);
    expect(forms('predecir', 'futuro')).toEqual(expect.arrayContaining(['prediré', 'predeciré']));
    expect(forms('bendecir', 'futuro')).toContain('bendeciré');
    expect(forms('bendecir', 'futuro')).not.toContain('bendiré');
    expect(forms('sobresalir', 'presente')).toContain('sobresalgo');
    expect(forms('sobresalir', 'futuro')).toContain('sobresaldré');
  });

  it('-ducir, traer, caer, oír, reír', () => {
    expect(forms('conducir', 'presente')).toContain('conduzco');
    expect(forms('conducir', 'indefinido')).toEqual(['conduje', 'condujiste', 'condujo', 'condujimos', 'condujeron']);
    expect(forms('reducir', 'subjuntivo_imperfecto')).toContain('redujéramos');
    expect(forms('traer', 'presente')).toEqual(['traigo', 'traes', 'trae', 'traemos', 'traen']);
    expect(forms('traer', 'indefinido')).toEqual(['traje', 'trajiste', 'trajo', 'trajimos', 'trajeron']);
    expect(forms('distraer', 'subjuntivo_presente')).toContain('distraiga');
    expect(forms('caer', 'presente')).toEqual(['caigo', 'caes', 'cae', 'caemos', 'caen']);
    expect(forms('caer', 'indefinido')).toEqual(['caí', 'caíste', 'cayó', 'caímos', 'cayeron']);
    expect(forms('caer', 'subjuntivo_imperfecto')).toContain('cayéramos');
    expect(forms('oír', 'presente')).toEqual(['oigo', 'oyes', 'oye', 'oímos', 'oyen']);
    expect(forms('oír', 'indefinido')).toEqual(['oí', 'oíste', 'oyó', 'oímos', 'oyeron']);
    expect(forms('oír', 'futuro')).toContain('oiré');
    expect(forms('reír', 'presente')).toEqual(['río', 'ríes', 'ríe', 'reímos', 'ríen']);
    expect(forms('reír', 'indefinido')).toEqual(expect.arrayContaining(['rió', 'rio', 'rieron']));
    expect(forms('sonreír', 'presente')).toContain('sonríe');
    expect(forms('sonreír', 'subjuntivo_imperfecto')).toContain('sonriera');
    expect(forms('freír', 'presente')).toContain('frío');
  });

  it('caber, valer, andar, adquirir, prever, soler', () => {
    expect(forms('caber', 'presente')).toEqual(['quepo', 'cabes', 'cabe', 'cabemos', 'caben']);
    expect(forms('caber', 'indefinido')).toContain('cupieron');
    expect(forms('caber', 'futuro')).toContain('cabré');
    expect(forms('valer', 'presente')).toContain('valgo');
    expect(forms('andar', 'indefinido')).toEqual(['anduve', 'anduviste', 'anduvo', 'anduvimos', 'anduvieron']);
    expect(forms('andar', 'presente')).toContain('anda');
    expect(forms('adquirir', 'presente')).toEqual(['adquiero', 'adquieres', 'adquiere', 'adquirimos', 'adquieren']);
    expect(forms('prever', 'presente')).toEqual(['preveo', 'prevés', 'prevé', 'prevemos', 'prevén']);
    expect(forms('prever', 'imperfecto')).toContain('preveía');
    expect(forms('soler', 'presente')).toEqual(['suelo', 'sueles', 'suele', 'solemos', 'suelen']);
    expect(forms('soler', 'indefinido')).toEqual([]);
  });
});

describe('impersonal verbs and hay', () => {
  it('llover, nevar, anochecer: the 3rd person singular only', () => {
    expect(forms('llover', 'presente')).toEqual(['llueve']);
    expect(forms('llover', 'indefinido')).toEqual(['llovió']);
    expect(forms('llover', 'futuro')).toEqual(['lloverá']);
    expect(forms('llover', 'subjuntivo_presente')).toEqual(['llueva']);
    expect(forms('nevar', 'presente')).toEqual(['nieva']);
    expect(forms('anochecer', 'indefinido')).toEqual(['anocheció']);
    expect(forms('anochecer', 'subjuntivo_presente')).toEqual(['anochezca']);
  });

  it('haber: the impersonal "hay" in the presente only (the rest is in conjugate)', () => {
    expect(forms('haber', 'presente')).toEqual(['hay']);
    expect(forms('haber', 'indefinido')).toEqual([]);
  });
});

describe('scope', () => {
  it('a regular verb or an unknown word is not this module\'s business', () => {
    expect(forms('hablar', 'presente')).toEqual([]);
    expect(forms('mesa', 'presente')).toEqual([]);
    expect(forms('ir', 'presente')).toEqual([]);
  });

  it('every corpus verb that conjugate skips has forms here', () => {
    const missing = new Set<string>();
    for (const w of getOpenWords()) {
      if (w.pos !== 'verb') continue;
      for (const alt of String(w.es).split(' / ')) {
        const written = alt.trim().toLowerCase();
        const inf = written.replace(/^(.+r)se$/, '$1');
        if (!/^[a-záéíóúñü]+(?:ar|er|ir|ír)$/.test(inf)) continue;
        if (IRREGULAR_INFINITIVES.has(inf) || conjugate(inf, 'presente')) continue;
        if (forms(inf, 'presente').length === 0) missing.add(inf);
      }
    }
    // A verb listed here is stem-changing, spelling-changing or irregular: add it to its class in lib/esIrregularForms.ts.
    expect([...missing]).toEqual([]);
  });

  it('the generated forms are one clean word each', () => {
    const tenses: IrregularTense[] = ['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo_presente', 'subjuntivo_imperfecto'];
    for (const inf of ['pensar', 'dormir', 'construir', 'oír', 'reír', 'prever', 'predecir', 'conocer', 'jugar', 'llover']) {
      for (const tense of tenses) {
        for (const form of forms(inf, tense)) expect(form).toMatch(/^[a-záéíóúñü]+$/);
      }
    }
  });
});
