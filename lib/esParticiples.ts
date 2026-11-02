// The Spanish past participle as an adjective (cerrado, cerrada, cerrados, cerradas), for the "learned words
// only" gate (lib/knownSentence.ts): a learned verb gives its participle in all four forms, in no tense (it
// stands as an adjective, "la puerta está cerrada"). The compound tenses (he cerrado) stay blocked by
// lib/grammar/tenseGate.ts. A pure module: `conjugate` TEACHES and is left alone, this only RECOGNISES.
//
// Regular: -ar → -ado, -er / -ir → -ido, with the accent when the stem ends in a, e or o (leer → leído,
// oír → oído, caer → caído, creer → creído, traer → traído, reír → reído). The irregular participles are
// listed by infinitive (hand-checked, the verbs of data/words-open/*.json and the compounds of the same
// bases); a prefix is never matched by an ending ("mover" and "llover" end in "ver" and are regular).

const IRREGULAR: Record<string, string[]> = {
  abrir: ['abierto'], reabrir: ['reabierto'], entreabrir: ['entreabierto'],
  cubrir: ['cubierto'], descubrir: ['descubierto'], encubrir: ['encubierto'], recubrir: ['recubierto'],
  decir: ['dicho'], contradecir: ['contradicho'], predecir: ['predicho'], desdecir: ['desdicho'],
  escribir: ['escrito'], describir: ['descrito'], inscribir: ['inscrito'], suscribir: ['suscrito'],
  reescribir: ['reescrito'], transcribir: ['transcrito'], prescribir: ['prescrito'],
  hacer: ['hecho'], deshacer: ['deshecho'], rehacer: ['rehecho'], satisfacer: ['satisfecho'],
  poner: ['puesto'], componer: ['compuesto'], descomponer: ['descompuesto'], disponer: ['dispuesto'],
  exponer: ['expuesto'], imponer: ['impuesto'], oponer: ['opuesto'], posponer: ['pospuesto'],
  proponer: ['propuesto'], suponer: ['supuesto'], reponer: ['repuesto'],
  ver: ['visto'], prever: ['previsto'], entrever: ['entrevisto'],
  volver: ['vuelto'], devolver: ['devuelto'], envolver: ['envuelto'], revolver: ['revuelto'],
  resolver: ['resuelto'], disolver: ['disuelto'], absolver: ['absuelto'],
  romper: ['roto'], morir: ['muerto'],
  // both forms are right
  freír: ['frito', 'freído'], imprimir: ['impreso', 'imprimido'],
};

// The vowels after which the -ido of an -er / -ir verb needs its accent (hiatus).
const OPEN_VOWEL = /[aeo]$/;

function masculine(infinitive: string): string[] {
  const irregular = IRREGULAR[infinitive];
  if (irregular) return irregular;
  const m = /^(.*)(ar|er|ir|ír)$/.exec(infinitive);
  if (!m) return [];
  const [, stem, ending] = m;
  if (ending === 'ar') return [`${stem}ado`];
  return [OPEN_VOWEL.test(stem) ? `${stem}ído` : `${stem}ido`];
}

/** The participle of an infinitive in masculine singular, feminine and both plurals; [] for anything that is not an infinitive. */
export function participleForms(infinitive: string): string[] {
  return masculine(infinitive).flatMap((p) => [p, `${p.slice(0, -1)}a`, `${p}s`, `${p.slice(0, -1)}as`]);
}
