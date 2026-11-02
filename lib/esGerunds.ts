// The Spanish gerundio (-ando, -iendo, -yendo) of a learned verb, for the "learned words only" gate
// (lib/knownSentence.ts). It stands in no tense ("estoy leyendo" is gated by estoy, "sigo trabajando" by sigo),
// and lib/grammar/tenseGate.ts has no gerund structure, so the progressive is not blocked there either.
// A pure module: `conjugate` TEACHES and is left alone, this only RECOGNISES.
//
// -ar: stem + ando, always (pensando, jugando). -er / -ir: stem + iendo, with -yendo after a vowel (leyendo,
// oyendo, cayendo, huyendo, construyendo; not after the silent u of -guir / -quir) and -endo after ñ / ll
// (gruñendo, bullendo). The few that go their own way are written out: ir (yendo), poder (pudiendo), the
// decir family (diciendo, bendiciendo), the venir family (viniendo, interviniendo) and reír / sonreír / freír
// (riendo, sonriendo, friendo). An -ir verb with a stem change takes the stem of its 3rd person plural indefinido
// (durmieron → durmiendo, pidieron → pidiendo, sintieron → sintiendo, siguieron → siguiendo), which the caller
// passes in; without it the plain stem is used. No -er verb changes its stem in the gerundio but poder.

/** The gerundio of an infinitive; [] for anything that is not an infinitive. */
export function gerundForms(infinitive: string, ellosIndefinido?: string): string[] {
  if (infinitive === 'ir') return ['yendo'];
  if (infinitive === 'poder') return ['pudiendo'];
  if (/decir$/.test(infinitive)) return [`${infinitive.slice(0, -5)}diciendo`];
  if (/venir$/.test(infinitive)) return [`${infinitive.slice(0, -5)}viniendo`];
  if (/eír$/.test(infinitive)) return [`${infinitive.slice(0, -3)}iendo`];
  const m = /^(.+)(ar|er|ir|ír)$/.exec(infinitive);
  if (!m) return [];
  const [, stem, ending] = m;
  if (ending === 'ar') return [`${stem}ando`];
  if (ending !== 'er' && ellosIndefinido) {
    if (ellosIndefinido.endsWith('ieron')) return [`${ellosIndefinido.slice(0, -5)}iendo`];
    if (ellosIndefinido.endsWith('yeron')) return [`${ellosIndefinido.slice(0, -5)}yendo`];
    if (/(?:ñ|ll)eron$/.test(ellosIndefinido)) return [`${ellosIndefinido.slice(0, -4)}endo`];
  }
  if (/(?:ñ|ll)$/.test(stem)) return [`${stem}endo`];
  if (/[aeoü]$/.test(stem) || /(?<![gq])u$/.test(stem)) return [`${stem}yendo`];
  return [`${stem}iendo`];
}
