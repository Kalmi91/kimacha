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
  CcatWordPairItem,
  CcatWordProblemItem,
  ChatData,
  ConfusablesSet,
  GrammarTopicData,
  LanguageContentBundle,
  MythItem,
  StoryData,
} from '../content';

import storyEsElMercado from '@/data/games/stories/es/el-mercado.json';
import storyEsElMetro from '@/data/games/stories/es/el-metro.json';
import storyEsElCollarDesaparecido from '@/data/games/stories/es/el-collar-desaparecido.json';
import storyEsLaLlamadaDeMedianoche from '@/data/games/stories/es/la-llamada-de-medianoche.json';
import storyEsElRobotPerdido from '@/data/games/stories/es/el-robot-perdido.json';
import storyEsElMensajeDelEspacio from '@/data/games/stories/es/el-mensaje-del-espacio.json';
import chatEsCocheUsado from '@/data/games/chats/es/coche-usado.json';
import chatEsAlquilerCdmx from '@/data/games/chats/es/alquiler-cdmx.json';
import chatEsAlimentacionSaludable from '@/data/games/chats/es/alimentacion-saludable.json';
import chatEsConsejoCarrera from '@/data/games/chats/es/consejo-carrera.json';
import chatEsWhatsappSospechoso from '@/data/games/chats/es/whatsapp-sospechoso.json';
import grammarEsSerEstar from '@/data/games/grammar/es/ser-estar.json';
import grammarEsArticulosGenero from '@/data/games/grammar/es/articulos-genero.json';
import grammarEsPorPara from '@/data/games/grammar/es/por-para.json';
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
import grammarEsImperfecto from '@/data/games/grammar/es/imperfecto.json';
import grammarEsIndefinidoImperfecto from '@/data/games/grammar/es/indefinido-imperfecto.json';
import grammarEsPerfecto from '@/data/games/grammar/es/perfecto.json';
import grammarEsFuturoSimple from '@/data/games/grammar/es/futuro-simple.json';
import confusablesEsSueldo from '@/data/games/confusables/es/sueldo-suelo-suelto.json';
import confusablesEsPero from '@/data/games/confusables/es/pero-perro.json';
import confusablesEsCaro from '@/data/games/confusables/es/caro-carro.json';
import confusablesEsCasa from '@/data/games/confusables/es/casa-caza.json';
import confusablesEsCocer from '@/data/games/confusables/es/cocer-coser.json';
import confusablesEsVes from '@/data/games/confusables/es/ves-vez.json';
import confusablesEsEcho from '@/data/games/confusables/es/echo-hecho.json';
import confusablesEsPimienta from '@/data/games/confusables/es/pimienta-pimiento.json';
import confusablesEsSaber from '@/data/games/confusables/es/saber-conocer.json';
import confusablesEsPedir from '@/data/games/confusables/es/pedir-preguntar.json';
import confusablesEsLlevar from '@/data/games/confusables/es/llevar-traer.json';
import confusablesEsIr from '@/data/games/confusables/es/ir-venir.json';
import confusablesEsSerEstar from '@/data/games/confusables/es/ser-estar.json';
import confusablesEsHay from '@/data/games/confusables/es/hay-esta.json';
import confusablesEsVaso from '@/data/games/confusables/es/vaso-copa-taza.json';
import confusablesEsMirar from '@/data/games/confusables/es/mirar-ver.json';
import confusablesEsQuedar from '@/data/games/confusables/es/quedar-quedarse.json';
import confusablesEsCoger from '@/data/games/confusables/es/coger-agarrar.json';
import confusablesEsAhorita from '@/data/games/confusables/es/ahorita-ahora-ya.json';
import confusablesEsMande from '@/data/games/confusables/es/mande-que.json';
import confusablesEsGuey from '@/data/games/confusables/es/guey-cuate-compa.json';
import confusablesEsChingon from '@/data/games/confusables/es/chingon-chido-padre.json';
import confusablesEsPlaticar from '@/data/games/confusables/es/platicar-hablar.json';
import confusablesEsRegional from '@/data/games/confusables/es/mx-regional-synonyms.json';
import mythsEsCommon from '@/data/games/myths/es/common.json';
import mythsEsBody from '@/data/games/myths/es/body.json';
import mythsEsMexico from '@/data/games/myths/es/mexico.json';
import mythsEsLanguage from '@/data/games/myths/es/language.json';
import ccatEsAntonyms from '@/data/games/ccat/es/antonyms.json';
import ccatEsSynonyms from '@/data/games/ccat/es/synonyms.json';
import ccatEsWordProblems from '@/data/games/ccat/es/word-problems.json';

export const esContent: LanguageContentBundle = {
  stories: [
    storyEsElMercado, storyEsElMetro, storyEsElCollarDesaparecido,
    storyEsLaLlamadaDeMedianoche, storyEsElRobotPerdido, storyEsElMensajeDelEspacio,
  ] as unknown as StoryData[],
  chats: [
    chatEsCocheUsado, chatEsAlquilerCdmx, chatEsAlimentacionSaludable,
    chatEsConsejoCarrera, chatEsWhatsappSospechoso,
  ] as unknown as ChatData[],
    // The JSON's per-item literal shape (each `wrong` only has the one key that
    // item actually needs) is narrower than GrammarWrongExplanation's index
    // signature, so a direct `as` doesn't overlap; `unknown` first is the
    // standard escape hatch for "this JSON conforms to the hand-written type,
    // TS just can't see it structurally".
    // A1 topics first (the learner meets them first), then the A2 pair.
    // Teaching order: A1 first, then A2. lib/grammar/syllabus.ts is the map that
    // groups these into units and says which ones are still unwritten.
  grammarTopics: [
    // FB189: a szófaj-áttekintés a tanterv első témája, minden későbbi szabály
    // (a melléknév a főnév után áll) ezt feltételezi.
    grammarEsClasesDePalabras,
    grammarEsSustantivoNumero,
    grammarEsArticulosGenero,
    grammarEsAdjetivoConcordancia,
    grammarEsPresenteRegular,
    grammarEsPresenteIrregular,
    grammarEsVerbosDiptongo,
    grammarEsSerEstar,
    grammarEsHayEstar,
    grammarEsPosesivos,
    grammarEsGustar,
    grammarEsIndefinidoRegular,
    grammarEsIndefinidoIrregular,
    grammarEsImperfecto,
    grammarEsIndefinidoImperfecto,
    grammarEsPerfecto,
    grammarEsFuturoSimple,
    grammarEsPorPara,
  ] as unknown as GrammarTopicData[],
  confusables: [
    confusablesEsSueldo, confusablesEsPero, confusablesEsCaro, confusablesEsCasa,
    confusablesEsCocer, confusablesEsVes, confusablesEsEcho, confusablesEsPimienta,
    confusablesEsSaber, confusablesEsPedir, confusablesEsLlevar, confusablesEsIr,
    confusablesEsSerEstar, confusablesEsHay, confusablesEsVaso, confusablesEsMirar,
    confusablesEsQuedar, confusablesEsCoger, confusablesEsAhorita, confusablesEsMande,
    confusablesEsGuey, confusablesEsChingon, confusablesEsPlaticar, confusablesEsRegional,
  ] as ConfusablesSet[],
  myths: [...mythsEsCommon, ...mythsEsBody, ...mythsEsMexico, ...mythsEsLanguage] as MythItem[],
  ccatAntonyms: ccatEsAntonyms as CcatWordPairItem[],
  ccatSynonyms: ccatEsSynonyms as CcatWordPairItem[],
  ccatWordProblems: ccatEsWordProblems as CcatWordProblemItem[],
};
