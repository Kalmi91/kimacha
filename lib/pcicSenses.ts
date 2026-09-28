// PLAN-fb0924 7b. lépés (FB384, D4): egy PCIC-szó több, ÉRDEMBEN eltérő
// jelentése a duplikátum-egyesítés után jelentés-listaként maradt meg.
// PLAN-ketiranyu 2. lépés (2026-09-28): a data/words alapú korpusznak nincs
// ilyen jelentés-lista adata, ezért ez a funkció alvó: `sensesFor` mindig
// undefined-ot ad, az aláírás változatlan. A data/pcic/senses.json fájl és a
// valódi PCIC-korpuszon futó ellenőrzése változatlanul fut tovább (lib/
// __tests__/pcicDedupGuard.test.ts, data/pcicCorpus.ts-re váltott importtal),
// csak ezt a stubbolt függvényt nem hívja.

export interface PcicSense {
  en: string;
  es: string;
}

/** Az item jelentés-listája. A gyakorisági korpuszon mindig undefined. */
export function sensesFor(_itemId: string): PcicSense[] | undefined {
  return undefined;
}
