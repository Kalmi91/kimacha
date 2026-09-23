// Issue #3: a spanyol sáv játék-tartalmának regisztrációja.
//
// Korábban mind a nyolc `…ByLang` map és a hozzájuk tartozó hatvan JSON-import
// egyetlen fájlban, a `lib/games/content.ts`-ben ült. Két nyelvi sáv így
// ugyanazokat a sorokat szerkesztette volna minden új tartalomnál. Mostantól
// egy nyelv = egy ilyen köteg-fájl, és a `content.ts` csak összefűzi őket:
// új nyelv = egy új fájl + egy sor a `BUNDLES` táblában.
//
// A típusok `import type`-pal jönnek, tehát futásidőben nincs körkörös import
// a `content.ts` felé, csak fordításidejű hivatkozás.

import type {
  GrammarTopicData,
  LanguageContentBundle,
} from '../content';

import grammarEsSerEstar from '@/data/games/grammar/es/ser-estar.json';
import grammarEsArticulosGenero from '@/data/games/grammar/es/articulos-genero.json';
import grammarEsPorPara from '@/data/games/grammar/es/por-para.json';
import grammarEsPerifrasisModales from '@/data/games/grammar/es/perifrasis-modales.json';
import grammarEsPronombresOd from '@/data/games/grammar/es/pronombres-od.json';
import grammarEsPronombresOi from '@/data/games/grammar/es/pronombres-oi.json';
import grammarEsQuienAQuien from '@/data/games/grammar/es/quien-a-quien.json';
import grammarEsIrAInfinitivo from '@/data/games/grammar/es/ir-a-infinitivo.json';
import grammarEsNumerosHoraFecha from '@/data/games/grammar/es/numeros-hora-fecha.json';
import grammarEsPreposicionesBasicas from '@/data/games/grammar/es/preposiciones-basicas.json';
import grammarEsEstarGerundio from '@/data/games/grammar/es/estar-gerundio.json';
import grammarEsVerbosReflexivos from '@/data/games/grammar/es/verbos-reflexivos.json';
import grammarEsSubjuntivoPresenteForma from '@/data/games/grammar/es/subjuntivo-presente-forma.json';
import grammarEsSubjuntivoDisparadores from '@/data/games/grammar/es/subjuntivo-disparadores.json';
import grammarEsTemporalesSubjuntivo from '@/data/games/grammar/es/temporales-subjuntivo.json';
import grammarEsCondicionalSimple from '@/data/games/grammar/es/condicional-simple.json';
import grammarEsCondicionalesTipo1 from '@/data/games/grammar/es/condicionales-tipo1.json';
import grammarEsSubjuntivoImperfecto from '@/data/games/grammar/es/subjuntivo-imperfecto.json';
import grammarEsCondicionalesTipo23 from '@/data/games/grammar/es/condicionales-tipo2-3.json';
import grammarEsEstiloIndirecto from '@/data/games/grammar/es/estilo-indirecto.json';
import grammarEsComparativosSuperlativos from '@/data/games/grammar/es/comparativos-superlativos.json';
import grammarEsFinalesCausales from '@/data/games/grammar/es/finales-causales.json';
import grammarEsMarcadoresDiscursivos from '@/data/games/grammar/es/marcadores-discursivos.json';
import grammarEsPresenteRegular from '@/data/games/grammar/es/presente-regular.json';
import grammarEsHayEstar from '@/data/games/grammar/es/hay-estar.json';
import grammarEsGustar from '@/data/games/grammar/es/gustar.json';
import grammarEsPosesivos from '@/data/games/grammar/es/posesivos.json';
import grammarEsClasesDePalabras from '@/data/games/grammar/es/clases-de-palabras.json';
import grammarEsSustantivoNumero from '@/data/games/grammar/es/sustantivo-numero.json';
import grammarEsAdjetivoConcordancia from '@/data/games/grammar/es/adjetivo-concordancia.json';
import grammarEsPresenteIrregular from '@/data/games/grammar/es/presente-irregular.json';
import grammarEsVerbosDiptongo from '@/data/games/grammar/es/verbos-diptongo.json';
import grammarEsIndefinidoRegular from '@/data/games/grammar/es/indefinido-regular.json';
import grammarEsIndefinidoIrregular from '@/data/games/grammar/es/indefinido-irregular.json';
import grammarEsIndefinido10Verbos from '@/data/games/grammar/es/indefinido-10-verbos.json';
import grammarEsImperfecto from '@/data/games/grammar/es/imperfecto.json';
import grammarEsIndefinidoImperfecto from '@/data/games/grammar/es/indefinido-imperfecto.json';
import grammarEsPerfecto from '@/data/games/grammar/es/perfecto.json';
import grammarEsFuturoSimple from '@/data/games/grammar/es/futuro-simple.json';
import grammarEsDemostrativos from '@/data/games/grammar/es/demostrativos.json';
import grammarEsInterrogativos from '@/data/games/grammar/es/interrogativos.json';
import grammarEsNegacion from '@/data/games/grammar/es/negacion.json';
import grammarEsImperativoAfirmativo from '@/data/games/grammar/es/imperativo-afirmativo.json';

// K33 (play-vágás, 2026-09-22): a Játék/Átbeszélő fülek és a hozzájuk tartozó
// data/games/{ccat,myths,chats,stories,confusables} mappák kikerültek. A
// 7. lépés (2026-09-23) a `LanguageContentBundle` mezőit is levágta erre az
// egyre: stories/chats/confusables/myths/ccat* kikerült, grammarTopics maradt.
export const esContent: LanguageContentBundle = {
    // The JSON's per-item literal shape (each `wrong` only has the one key that
    // item actually needs) is narrower than GrammarWrongExplanation's index
    // signature, so a direct `as` doesn't overlap; `unknown` first is the
    // standard escape hatch for "this JSON conforms to the hand-written type,
    // TS just can't see it structurally".
    // A1 topics first (the learner meets them first), then the A2 pair.
    // Teaching order: A1 first, then A2. lib/grammar/syllabus.ts is the map that
    // groups these into units and says which ones are still unwritten.
  grammarTopics: [
    // Tanulási sorrend = lib/grammar/syllabus.ts sorrendje. A core+ sáv (a
    // beszéd-mag) témái ebben a sorban jönnek, A1-től B1-ig.
    grammarEsClasesDePalabras,
    grammarEsSustantivoNumero,
    grammarEsArticulosGenero,
    grammarEsAdjetivoConcordancia,
    grammarEsPresenteRegular,
    grammarEsPresenteIrregular,
    grammarEsVerbosDiptongo,
    grammarEsPerifrasisModales,
    grammarEsSerEstar,
    grammarEsHayEstar,
    grammarEsPosesivos,
    grammarEsDemostrativos,
    grammarEsPronombresOd,
    grammarEsPronombresOi,
    grammarEsQuienAQuien,
    grammarEsInterrogativos,
    grammarEsNegacion,
    grammarEsGustar,
    grammarEsIrAInfinitivo,
    grammarEsNumerosHoraFecha,
    grammarEsPreposicionesBasicas,
    grammarEsIndefinidoRegular,
    grammarEsIndefinidoIrregular,
    grammarEsIndefinido10Verbos,
    grammarEsImperfecto,
    grammarEsIndefinidoImperfecto,
    grammarEsPerfecto,
    grammarEsEstarGerundio,
    grammarEsFuturoSimple,
    grammarEsImperativoAfirmativo,
    grammarEsVerbosReflexivos,
    grammarEsPorPara,
    grammarEsSubjuntivoPresenteForma,
    grammarEsSubjuntivoDisparadores,
    grammarEsTemporalesSubjuntivo,
    grammarEsCondicionalSimple,
    grammarEsCondicionalesTipo1,
    grammarEsSubjuntivoImperfecto,
    grammarEsCondicionalesTipo23,
    grammarEsEstiloIndirecto,
    grammarEsComparativosSuperlativos,
    grammarEsFinalesCausales,
    grammarEsMarcadoresDiscursivos,
  ] as unknown as GrammarTopicData[],
};
