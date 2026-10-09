// Issue #3: registration of the Spanish lane's game content.
//
// Previously all eight `…ByLang` maps and their sixty JSON imports lived
// in a single file, `lib/games/content.ts`. Two language lanes would thus
// have edited the same lines for every new piece of content. From now on
// one language = one bundle file like this, and `content.ts` only stitches them together:
// a new language = a new file + one line in the `BUNDLES` table.
//
// The types come in via `import type`, so there is no circular import at
// runtime towards `content.ts`, only a compile-time reference.

import type {
  GrammarTopicData,
  LanguageContentBundle,
} from '../content';

import grammarEsSerEstar from '@/data/games/grammar/es/ser-estar.json';
import grammarEsArticulosGenero from '@/data/games/grammar/es/articulos-genero.json';
import { withArticleNouns } from '@/lib/grammar/nounArticles';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import grammarEsPorPara from '@/data/games/grammar/es/por-para.json';
import grammarEsPerifrasisModales from '@/data/games/grammar/es/perifrasis-modales.json';
import grammarEsPronombresOd from '@/data/games/grammar/es/pronombres-od.json';
import grammarEsPronombresOi from '@/data/games/grammar/es/pronombres-oi.json';
import grammarEsCombinacionPronombres from '@/data/games/grammar/es/combinacion-pronombres.json';
import grammarEsPronombresPreposicion from '@/data/games/grammar/es/pronombres-preposicion.json';
import grammarEsQuienAQuien from '@/data/games/grammar/es/quien-a-quien.json';
import grammarEsIrAInfinitivo from '@/data/games/grammar/es/ir-a-infinitivo.json';
import grammarEsMuyMucho from '@/data/games/grammar/es/muy-mucho.json';
import grammarEsNumerosHoraFecha from '@/data/games/grammar/es/numeros-hora-fecha.json';
import grammarEsPreposicionesBasicas from '@/data/games/grammar/es/preposiciones-basicas.json';
import grammarEsEstarGerundio from '@/data/games/grammar/es/estar-gerundio.json';
import grammarEsVerbosReflexivos from '@/data/games/grammar/es/verbos-reflexivos.json';
import grammarEsVerbosComoGustar from '@/data/games/grammar/es/verbos-como-gustar.json';
import grammarEsSubjuntivoPresenteForma from '@/data/games/grammar/es/subjuntivo-presente-forma.json';
import grammarEsSubjuntivoDisparadores from '@/data/games/grammar/es/subjuntivo-disparadores.json';
import grammarEsOjalaQuizas from '@/data/games/grammar/es/ojala-quizas.json';
import grammarEsTemporalesSubjuntivo from '@/data/games/grammar/es/temporales-subjuntivo.json';
import grammarEsSubjuntivoRelativo from '@/data/games/grammar/es/subjuntivo-relativo.json';
import grammarEsCondicionalSimple from '@/data/games/grammar/es/condicional-simple.json';
import grammarEsCondicionalesTipo1 from '@/data/games/grammar/es/condicionales-tipo1.json';
import grammarEsRelativos from '@/data/games/grammar/es/relativos.json';
import grammarEsPerifrasis from '@/data/games/grammar/es/perifrasis.json';
import grammarEsPluscuamperfecto from '@/data/games/grammar/es/pluscuamperfecto.json';
import grammarEsIndefinidos from '@/data/games/grammar/es/indefinidos.json';
import grammarEsGerundioParticipio from '@/data/games/grammar/es/gerundio-participio-construcciones.json';
import grammarEsLoNeutro from '@/data/games/grammar/es/lo-neutro.json';
import grammarEsPasivaSerParticipio from '@/data/games/grammar/es/pasiva-ser-participio.json';
import grammarEsSubjuntivoImperfecto from '@/data/games/grammar/es/subjuntivo-imperfecto.json';
import grammarEsSubjuntivoPerfecto from '@/data/games/grammar/es/subjuntivo-perfecto.json';
import grammarEsConcesivas from '@/data/games/grammar/es/concesivas.json';
import grammarEsFuturoCondicionalPerfecto from '@/data/games/grammar/es/futuro-condicional-perfecto.json';
import grammarEsLeismoLaismo from '@/data/games/grammar/es/leismo-laismo.json';
import grammarEsProbabilidadConTiempos from '@/data/games/grammar/es/probabilidad-con-tiempos.json';
import grammarEsRelativosComplejos from '@/data/games/grammar/es/relativos-complejos.json';
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
import grammarEsPerfectoVsIndefinido from '@/data/games/grammar/es/perfecto-vs-indefinido.json';
import grammarEsFuturoSimple from '@/data/games/grammar/es/futuro-simple.json';
import grammarEsMarcadoresTemporales from '@/data/games/grammar/es/marcadores-temporales.json';
import grammarEsDemostrativos from '@/data/games/grammar/es/demostrativos.json';
import grammarEsInterrogativos from '@/data/games/grammar/es/interrogativos.json';
import grammarEsNegacion from '@/data/games/grammar/es/negacion.json';
import grammarEsImperativoAfirmativo from '@/data/games/grammar/es/imperativo-afirmativo.json';
import grammarEsImperativoNegativo from '@/data/games/grammar/es/imperativo-negativo.json';
import grammarEsLlevarTraerIrVenir from '@/data/games/grammar/es/llevar-traer-ir-venir.json';
import grammarEsPedirPreguntar from '@/data/games/grammar/es/pedir-preguntar.json';
import grammarEsSaberConocer from '@/data/games/grammar/es/saber-conocer.json';
import grammarEsPorParaAvanzado from '@/data/games/grammar/es/por-para-avanzado.json';
import grammarEsVerbosPreposicion from '@/data/games/grammar/es/verbos-preposicion.json';
import grammarEsVerbosDeCambio from '@/data/games/grammar/es/verbos-de-cambio.json';
import grammarEsEstarParticipio from '@/data/games/grammar/es/estar-participio.json';
import grammarEsImperativoPronombres from '@/data/games/grammar/es/imperativo-pronombres.json';
import grammarEsHaceDesdeHace from '@/data/games/grammar/es/hace-desde-hace.json';
import grammarEsDiminutivos from '@/data/games/grammar/es/diminutivos.json';
import grammarEsOracionesConsecutivas from '@/data/games/grammar/es/oraciones-consecutivas.json';
import grammarEsSeImpersonalPasiva from '@/data/games/grammar/es/se-impersonal-pasiva.json';
import grammarEsSeAccidental from '@/data/games/grammar/es/se-accidental.json';
import grammarEsNumeralesOrdinales from '@/data/games/grammar/es/numerales-ordinales.json';

// Play cut: the Games/Átbeszélő tabs and their
// data/games/{ccat,myths,chats,stories,confusables} folders were removed. The
// Play cut also trimmed the `LanguageContentBundle` fields down to this
// one: stories/chats/confusables/myths/ccat* are gone, grammarTopics remains.
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
    // Learning order = the order of lib/grammar/syllabus.ts. The topics of the core+ lane (the
    // speech core) come in this sequence, from A1 to B1.
    grammarEsClasesDePalabras,
    grammarEsSustantivoNumero,
    // every noun in the app also as an el / la exercise (lib/grammar/nounArticles.ts).
    withArticleNouns(grammarEsArticulosGenero as unknown as LessonV2),
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
    grammarEsMuyMucho,
    grammarEsNumerosHoraFecha,
    grammarEsPreposicionesBasicas,
    grammarEsIndefinidoRegular,
    grammarEsIndefinidoIrregular,
    grammarEsIndefinido10Verbos,
    grammarEsImperfecto,
    grammarEsIndefinidoImperfecto,
    grammarEsPerfecto,
    grammarEsPerfectoVsIndefinido,
    grammarEsEstarGerundio,
    grammarEsFuturoSimple,
    grammarEsMarcadoresTemporales,
    grammarEsImperativoAfirmativo,
    grammarEsImperativoNegativo,
    grammarEsCombinacionPronombres,
    grammarEsPronombresPreposicion,
    grammarEsVerbosReflexivos,
    grammarEsVerbosComoGustar,
    grammarEsPorPara,
    grammarEsSaberConocer,
    grammarEsPedirPreguntar,
    grammarEsLlevarTraerIrVenir,
    grammarEsSubjuntivoPresenteForma,
    grammarEsSubjuntivoDisparadores,
    grammarEsOjalaQuizas,
    grammarEsTemporalesSubjuntivo,
    grammarEsSubjuntivoRelativo,
    grammarEsCondicionalSimple,
    grammarEsCondicionalesTipo1,
    grammarEsRelativos,
    grammarEsSeImpersonalPasiva,
    grammarEsSeAccidental,
    grammarEsNumeralesOrdinales,
    grammarEsPerifrasis,
    grammarEsPorParaAvanzado,
    grammarEsVerbosPreposicion,
    grammarEsVerbosDeCambio,
    grammarEsEstarParticipio,
    grammarEsImperativoPronombres,
    grammarEsHaceDesdeHace,
    grammarEsDiminutivos,
    grammarEsOracionesConsecutivas,
    grammarEsPluscuamperfecto,
    grammarEsIndefinidos,
    grammarEsGerundioParticipio,
    grammarEsLoNeutro,
    grammarEsPasivaSerParticipio,
    grammarEsSubjuntivoImperfecto,
    grammarEsSubjuntivoPerfecto,
    grammarEsConcesivas,
    grammarEsFuturoCondicionalPerfecto,
    grammarEsLeismoLaismo,
    grammarEsProbabilidadConTiempos,
    grammarEsRelativosComplejos,
    grammarEsCondicionalesTipo23,
    grammarEsEstiloIndirecto,
    grammarEsComparativosSuperlativos,
    grammarEsFinalesCausales,
    grammarEsMarcadoresDiscursivos,
  ] as unknown as GrammarTopicData[],
};
