// The grammar syllabus: every grammar point the course intends to teach from
// A1 to C1, in teaching order, grouped into units.
//
// Kálmán, 2026-09-08: "minden szintnek van nyelvtani része is... tedd bele a
// nyelvtant a szintekbe is. meg külön legyen egy nyelvtani tanulás rész ahol
// szépen átveszi az összes nyelvtant... azt akarom, hogy átfogó legyen és
// minden szükséges nyelvtan legyen benne."
//
// This module is the MAP. The lessons themselves live in the authored corpus
// (data/games/grammar/<lang>/<topic>.json) which the drill game already uses,
// so a topic is written once and serves both the study screen and the game.
// A topic with no file yet is shown as planned-but-not-written; the screen
// never pretends an empty lesson exists.

import { getGrammarTopic, getGrammarTopics, type GrammarTopicData } from '@/lib/games/content';
import type { Level } from '@/data/words';

export interface SyllabusTopic {
  id: string;
  level: Level;
  unit: string; // unit id within the level
  title: Record<string, string>;
  /** One line on what it is for, shown under the title on the syllabus screen. */
  blurb: Record<string, string>;
}

export interface SyllabusUnit {
  id: string;
  level: Level;
  title: Record<string, string>;
}

export const GRAMMAR_UNITS: SyllabusUnit[] = [
  // --- A1 -----------------------------------------------------------------
  { id: 'a1-nombre', level: 'A1', title: { hu: 'Főnév, névelő, melléknév', en: 'Nouns, articles, adjectives', es: 'Sustantivo, artículo, adjetivo', de: 'Nomen, Artikel, Adjektiv' } },
  { id: 'a1-presente', level: 'A1', title: { hu: 'Jelen idő', en: 'The present tense', es: 'El presente', de: 'Das Präsens' } },
  { id: 'a1-ser-estar', level: 'A1', title: { hu: 'Ser, estar, hay', en: 'Ser, estar, hay', es: 'Ser, estar, hay', de: 'Ser, estar, hay' } },
  { id: 'a1-pronombres', level: 'A1', title: { hu: 'Névmások és mutatószók', en: 'Pronouns and demonstratives', es: 'Pronombres y demostrativos', de: 'Pronomen und Demonstrativa' } },
  { id: 'a1-frase', level: 'A1', title: { hu: 'Kérdés, tagadás, tetszés', en: 'Questions, negation, liking', es: 'Preguntas, negación, gustar', de: 'Fragen, Verneinung, gustar' } },
  { id: 'a1-cantidad', level: 'A1', title: { hu: 'Mennyiség, idő, elöljárók', en: 'Quantity, time, prepositions', es: 'Cantidad, tiempo, preposiciones', de: 'Menge, Zeit, Präpositionen' } },
  // --- A2 -----------------------------------------------------------------
  { id: 'a2-pasado', level: 'A2', title: { hu: 'Múlt idő', en: 'The past tenses', es: 'Los tiempos del pasado', de: 'Die Vergangenheit' } },
  { id: 'a2-futuro', level: 'A2', title: { hu: 'Jövő idő és felszólítás', en: 'Future and imperative', es: 'Futuro e imperativo', de: 'Futur und Imperativ' } },
  { id: 'a2-pronombres', level: 'A2', title: { hu: 'Tárgy- és részeshatározós névmások', en: 'Object pronouns', es: 'Pronombres de objeto', de: 'Objektpronomen' } },
  { id: 'a2-verbos', level: 'A2', title: { hu: 'Gyakran kevert igepárok', en: 'Verb pairs that get mixed up', es: 'Verbos que se confunden', de: 'Verwechselte Verbpaare' } },
  { id: 'a2-comparar', level: 'A2', title: { hu: 'Összehasonlítás és mennyiség', en: 'Comparison and quantity', es: 'Comparación y cantidad', de: 'Vergleich und Menge' } },
  // --- B1 -----------------------------------------------------------------
  { id: 'b1-subjuntivo', level: 'B1', title: { hu: 'Kötőmód (subjuntivo)', en: 'The subjunctive', es: 'El subjuntivo', de: 'Der Subjuntivo' } },
  { id: 'b1-condicional', level: 'B1', title: { hu: 'Feltételes mód és feltételes mondat', en: 'Conditional and if-clauses', es: 'Condicional y condicionales', de: 'Konditional und Bedingungssätze' } },
  { id: 'b1-estructuras', level: 'B1', title: { hu: 'Vonatkozó, személytelen, körülírás', en: 'Relatives, impersonal, verb phrases', es: 'Relativos, impersonal, perífrasis', de: 'Relativsätze, unpersönlich, Verbalperiphrasen' } },
  // --- B2 -----------------------------------------------------------------
  { id: 'b2-subjuntivo', level: 'B2', title: { hu: 'Összetett kötőmód', en: 'Advanced subjunctive', es: 'Subjuntivo avanzado', de: 'Fortgeschrittener Subjuntivo' } },
  { id: 'b2-oraciones', level: 'B2', title: { hu: 'Mondatkapcsolás és passzív', en: 'Clause linking and the passive', es: 'Conexión de oraciones y pasiva', de: 'Satzverbindung und Passiv' } },
  // --- C1 -----------------------------------------------------------------
  { id: 'c1-matices', level: 'C1', title: { hu: 'Árnyalatok és regiszter', en: 'Nuance and register', es: 'Matices y registro', de: 'Nuancen und Register' } },
];

export const GRAMMAR_SYLLABUS: SyllabusTopic[] = [
  // ========================= A1 =========================
  {
    id: 'sustantivo-numero',
    level: 'A1',
    unit: 'a1-nombre',
    title: { hu: 'Főnév: nem és többes szám', en: 'Nouns: gender and plural', es: 'El sustantivo: género y número', de: 'Nomen: Genus und Plural' },
    blurb: { hu: '-o hím, -a nő, és hogyan lesz belőle többes szám.', en: '-o masculine, -a feminine, and how the plural is formed.', es: '-o masculino, -a femenino y cómo se forma el plural.', de: '-o maskulin, -a feminin und wie der Plural entsteht.' },
  },
  {
    id: 'articulos-genero',
    level: 'A1',
    unit: 'a1-nombre',
    title: { hu: 'Névelők: el, la, un, una', en: 'Articles: el, la, un, una', es: 'Artículos: el, la, un, una', de: 'Artikel: el, la, un, una' },
    blurb: { hu: 'Határozott és határozatlan névelő, nemmel egyeztetve.', en: 'Definite and indefinite articles, agreeing in gender.', es: 'Artículo determinado e indeterminado, con género.', de: 'Bestimmter und unbestimmter Artikel mit Genus.' },
  },
  {
    id: 'adjetivo-concordancia',
    level: 'A1',
    unit: 'a1-nombre',
    title: { hu: 'Melléknév-egyeztetés', en: 'Adjective agreement', es: 'Concordancia del adjetivo', de: 'Adjektivangleichung' },
    blurb: { hu: 'A melléknév a főnév nemét és számát veszi fel, és mögé kerül.', en: 'The adjective takes the noun gender and number, and follows it.', es: 'El adjetivo concuerda en género y número y va detrás.', de: 'Das Adjektiv passt sich an und steht dahinter.' },
  },
  {
    id: 'presente-regular',
    level: 'A1',
    unit: 'a1-presente',
    title: { hu: 'Jelen idő: szabályos igék', en: 'Present: regular verbs', es: 'Presente: verbos regulares', de: 'Präsens: regelmäßige Verben' },
    blurb: { hu: '-ar, -er, -ir végződések mind a hat személyben.', en: 'The -ar, -er, -ir endings in all six persons.', es: 'Las terminaciones -ar, -er, -ir en las seis personas.', de: 'Die Endungen -ar, -er, -ir in allen sechs Personen.' },
  },
  {
    id: 'presente-irregular',
    level: 'A1',
    unit: 'a1-presente',
    title: { hu: 'Jelen idő: rendhagyó igék', en: 'Present: irregular verbs', es: 'Presente: verbos irregulares', de: 'Präsens: unregelmäßige Verben' },
    blurb: { hu: 'tener, venir, ir, hacer, salir, poner, decir, saber.', en: 'tener, venir, ir, hacer, salir, poner, decir, saber.', es: 'tener, venir, ir, hacer, salir, poner, decir, saber.', de: 'tener, venir, ir, hacer, salir, poner, decir, saber.' },
  },
  {
    id: 'verbos-diptongo',
    level: 'A1',
    unit: 'a1-presente',
    title: { hu: 'Tőhangváltós igék: e→ie, o→ue, e→i', en: 'Stem-changing verbs: e→ie, o→ue, e→i', es: 'Verbos con diptongo: e→ie, o→ue, e→i', de: 'Diphthongierende Verben: e→ie, o→ue, e→i' },
    blurb: { hu: 'querer, poder, pedir: a tő változik, a végződés nem.', en: 'querer, poder, pedir: the stem changes, the ending does not.', es: 'querer, poder, pedir: cambia la raíz, no la terminación.', de: 'querer, poder, pedir: der Stamm ändert sich, nicht die Endung.' },
  },
  {
    id: 'ser-estar',
    level: 'A1',
    unit: 'a1-ser-estar',
    title: { hu: 'Ser vagy estar?', en: 'Ser or estar?', es: '¿Ser o estar?', de: 'Ser oder estar?' },
    blurb: { hu: 'Állandó tulajdonság vagy pillanatnyi állapot.', en: 'A lasting quality or a current state.', es: 'Cualidad estable o estado actual.', de: 'Dauerhafte Eigenschaft oder momentaner Zustand.' },
  },
  {
    id: 'hay-estar',
    level: 'A1',
    unit: 'a1-ser-estar',
    title: { hu: 'Hay vagy está?', en: 'Hay or está?', es: '¿Hay o está?', de: 'Hay oder está?' },
    blurb: { hu: 'Létezik valami, vagy egy ismert dolog hol van.', en: 'Something exists, or where a known thing is.', es: 'Algo existe, o dónde está algo conocido.', de: 'Etwas existiert, oder wo etwas Bekanntes ist.' },
  },
  {
    id: 'posesivos',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { hu: 'Birtokos: mi, tu, su, nuestro', en: 'Possessives: mi, tu, su, nuestro', es: 'Posesivos: mi, tu, su, nuestro', de: 'Possessivbegleiter' },
    blurb: { hu: 'A birtokkal egyezik, nem a birtokossal.', en: 'It agrees with the thing owned, not the owner.', es: 'Concuerda con lo poseído, no con el poseedor.', de: 'Richtet sich nach dem Besitz, nicht dem Besitzer.' },
  },
  {
    id: 'demostrativos',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { hu: 'Mutató névmások: este, ese, aquel', en: 'Demonstratives: este, ese, aquel', es: 'Demostrativos: este, ese, aquel', de: 'Demonstrativa: este, ese, aquel' },
    blurb: { hu: 'Három távolság: itt, ott, amott.', en: 'Three distances: here, there, over there.', es: 'Tres distancias: aquí, ahí, allí.', de: 'Drei Entfernungen: hier, da, dort.' },
  },
  {
    id: 'interrogativos',
    level: 'A1',
    unit: 'a1-frase',
    title: { hu: 'Kérdőszavak', en: 'Question words', es: 'Interrogativos', de: 'Fragewörter' },
    blurb: { hu: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.', en: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.', es: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.', de: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.' },
  },
  {
    id: 'negacion',
    level: 'A1',
    unit: 'a1-frase',
    title: { hu: 'Tagadás: no, nada, nunca, nadie', en: 'Negation: no, nada, nunca, nadie', es: 'Negación: no, nada, nunca, nadie', de: 'Verneinung: no, nada, nunca, nadie' },
    blurb: { hu: 'A spanyol kettős tagadást használ, és ez helyes.', en: 'Spanish uses a double negative, and that is correct.', es: 'El español usa doble negación y es correcto.', de: 'Spanisch nutzt doppelte Verneinung, und das ist richtig.' },
  },
  {
    id: 'gustar',
    level: 'A1',
    unit: 'a1-frase',
    title: { hu: 'Gustar szerkezet', en: 'The gustar structure', es: 'La estructura con gustar', de: 'Die gustar-Struktur' },
    blurb: { hu: 'Nem én szeretem, hanem az tetszik nekem.', en: 'Not "I like it" but "it pleases me".', es: 'No «yo quiero», sino «me gusta».', de: 'Nicht „ich mag", sondern „es gefällt mir".' },
  },
  {
    id: 'ir-a-infinitivo',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { hu: 'Közeljövő: ir a + főnévi igenév', en: 'Near future: ir a + infinitive', es: 'Futuro próximo: ir a + infinitivo', de: 'Nahe Zukunft: ir a + Infinitiv' },
    blurb: { hu: 'Voy a comer: a leggyakoribb jövő idő a beszédben.', en: 'Voy a comer: the future people actually speak.', es: 'Voy a comer: el futuro más usado al hablar.', de: 'Voy a comer: die meistgesprochene Zukunft.' },
  },
  {
    id: 'muy-mucho',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { hu: 'Muy vagy mucho?', en: 'Muy or mucho?', es: '¿Muy o mucho?', de: 'Muy oder mucho?' },
    blurb: { hu: 'Muy melléknév elé, mucho főnév mellé vagy ige után.', en: 'Muy before an adjective, mucho with a noun or after a verb.', es: 'Muy ante adjetivo, mucho con sustantivo o tras el verbo.', de: 'Muy vor Adjektiv, mucho beim Nomen oder nach dem Verb.' },
  },
  {
    id: 'numeros-hora-fecha',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { hu: 'Számok, óra, dátum', en: 'Numbers, time, date', es: 'Números, hora y fecha', de: 'Zahlen, Uhrzeit, Datum' },
    blurb: { hu: 'Son las tres, el 5 de mayo, a las ocho y media.', en: 'Son las tres, el 5 de mayo, a las ocho y media.', es: 'Son las tres, el 5 de mayo, a las ocho y media.', de: 'Son las tres, el 5 de mayo, a las ocho y media.' },
  },
  {
    id: 'preposiciones-basicas',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { hu: 'Alap elöljárók: a, de, en, con, por', en: 'Basic prepositions: a, de, en, con, por', es: 'Preposiciones básicas: a, de, en, con, por', de: 'Grundpräpositionen: a, de, en, con, por' },
    blurb: { hu: 'Az a + el = al és a de + el = del összevonás is.', en: 'Including the contractions a + el = al and de + el = del.', es: 'Incluidas las contracciones al y del.', de: 'Auch die Verschmelzungen al und del.' },
  },
  // ========================= A2 =========================
  {
    id: 'indefinido-regular',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Befejezett múlt: szabályos igék', en: 'Preterite: regular verbs', es: 'Pretérito indefinido: regulares', de: 'Indefinido: regelmäßige Verben' },
    blurb: { hu: 'Hablé, comí, viví: a lezárt múlt alapalakja.', en: 'Hablé, comí, viví: the finished past.', es: 'Hablé, comí, viví: el pasado terminado.', de: 'Hablé, comí, viví: die abgeschlossene Vergangenheit.' },
  },
  {
    id: 'indefinido-irregular',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Befejezett múlt: rendhagyó igék', en: 'Preterite: irregular verbs', es: 'Pretérito indefinido: irregulares', de: 'Indefinido: unregelmäßige Verben' },
    blurb: { hu: 'fui, tuve, hice, dije, estuve, pude, quise.', en: 'fui, tuve, hice, dije, estuve, pude, quise.', es: 'fui, tuve, hice, dije, estuve, pude, quise.', de: 'fui, tuve, hice, dije, estuve, pude, quise.' },
  },
  {
    id: 'imperfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Folyamatos múlt (imperfecto)', en: 'The imperfect', es: 'El pretérito imperfecto', de: 'Das Imperfekt' },
    blurb: { hu: 'Hablaba, comía: szokás, háttér, leírás a múltban.', en: 'Hablaba, comía: habit, background, description.', es: 'Hablaba, comía: costumbre, fondo, descripción.', de: 'Hablaba, comía: Gewohnheit, Hintergrund, Beschreibung.' },
  },
  {
    id: 'indefinido-imperfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Indefinido vagy imperfecto?', en: 'Preterite or imperfect?', es: '¿Indefinido o imperfecto?', de: 'Indefinido oder Imperfekt?' },
    blurb: { hu: 'A két múlt idő közti választás, mondatpárokon.', en: 'Choosing between the two pasts, on contrast pairs.', es: 'La elección entre los dos pasados, con pares.', de: 'Die Wahl zwischen beiden Vergangenheiten.' },
  },
  {
    id: 'perfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Közelmúlt (pretérito perfecto)', en: 'The present perfect', es: 'El pretérito perfecto', de: 'Das Perfekt' },
    blurb: { hu: 'He comido: ma, esta semana, todavía no.', en: 'He comido: today, this week, not yet.', es: 'He comido: hoy, esta semana, todavía no.', de: 'He comido: heute, diese Woche, noch nicht.' },
  },
  {
    id: 'estar-gerundio',
    level: 'A2',
    unit: 'a2-pasado',
    title: { hu: 'Éppen most: estar + gerundio', en: 'Right now: estar + gerund', es: 'Ahora mismo: estar + gerundio', de: 'Gerade jetzt: estar + Gerundium' },
    blurb: { hu: 'Estoy comiendo: ami épp zajlik.', en: 'Estoy comiendo: what is happening right now.', es: 'Estoy comiendo: lo que pasa ahora.', de: 'Estoy comiendo: was gerade passiert.' },
  },
  {
    id: 'futuro-simple',
    level: 'A2',
    unit: 'a2-futuro',
    title: { hu: 'Egyszerű jövő idő', en: 'The simple future', es: 'El futuro simple', de: 'Das einfache Futur' },
    blurb: { hu: 'Hablaré, comeré: ígéret, jóslat, valószínűség.', en: 'Hablaré, comeré: promise, prediction, probability.', es: 'Hablaré, comeré: promesa, predicción, probabilidad.', de: 'Hablaré, comeré: Versprechen, Vorhersage, Vermutung.' },
  },
  {
    id: 'imperativo-afirmativo',
    level: 'A2',
    unit: 'a2-futuro',
    title: { hu: 'Felszólítás: állító alak', en: 'Imperative: affirmative', es: 'Imperativo afirmativo', de: 'Imperativ: bejahend' },
    blurb: { hu: 'Habla, come, ven, haz: kérés és utasítás.', en: 'Habla, come, ven, haz: asking and telling.', es: 'Habla, come, ven, haz: pedir y ordenar.', de: 'Habla, come, ven, haz: bitten und auffordern.' },
  },
  {
    id: 'imperativo-negativo',
    level: 'A2',
    unit: 'a2-futuro',
    title: { hu: 'Felszólítás: tiltó alak', en: 'Imperative: negative', es: 'Imperativo negativo', de: 'Imperativ: verneint' },
    blurb: { hu: 'No hables, no comas: a tiltás kötőmódot használ.', en: 'No hables, no comas: the negative uses the subjunctive.', es: 'No hables, no comas: la prohibición usa subjuntivo.', de: 'No hables, no comas: das Verbot nutzt den Subjuntivo.' },
  },
  {
    id: 'pronombres-od',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { hu: 'Tárgyeseti névmás: lo, la, los, las', en: 'Direct object: lo, la, los, las', es: 'Objeto directo: lo, la, los, las', de: 'Akkusativpronomen: lo, la, los, las' },
    blurb: { hu: 'Ne ismételd a főnevet: ¿El libro? Lo tengo.', en: 'Do not repeat the noun: ¿El libro? Lo tengo.', es: 'No repitas el sustantivo: ¿El libro? Lo tengo.', de: 'Wiederhole das Nomen nicht: ¿El libro? Lo tengo.' },
  },
  {
    id: 'pronombres-oi',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { hu: 'Részeshatározós névmás: me, te, le, nos, les', en: 'Indirect object: me, te, le, nos, les', es: 'Objeto indirecto: me, te, le, nos, les', de: 'Dativpronomen: me, te, le, nos, les' },
    blurb: { hu: 'Kinek adod, kinek mondod: le doy el libro.', en: 'Who you give it to: le doy el libro.', es: 'A quién se lo das: le doy el libro.', de: 'Wem du es gibst: le doy el libro.' },
  },
  {
    id: 'combinacion-pronombres',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { hu: 'Két névmás együtt: se lo doy', en: 'Two pronouns together: se lo doy', es: 'Dos pronombres juntos: se lo doy', de: 'Zwei Pronomen zusammen: se lo doy' },
    blurb: { hu: 'A sorrend kötött, és a le se-vé válik.', en: 'The order is fixed, and le turns into se.', es: 'El orden es fijo y le se convierte en se.', de: 'Die Reihenfolge ist fest, und le wird zu se.' },
  },
  {
    id: 'verbos-reflexivos',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { hu: 'Visszaható igék', en: 'Reflexive verbs', es: 'Verbos reflexivos', de: 'Reflexive Verben' },
    blurb: { hu: 'Me levanto, se llama: a névmás a cselekvőre mutat vissza.', en: 'Me levanto, se llama: the pronoun points back at the doer.', es: 'Me levanto, se llama: el pronombre vuelve al sujeto.', de: 'Me levanto, se llama: das Pronomen zeigt zurück.' },
  },
  {
    id: 'comparativos-superlativos',
    level: 'A2',
    unit: 'a2-comparar',
    title: { hu: 'Összehasonlítás és felsőfok', en: 'Comparatives and superlatives', es: 'Comparativos y superlativos', de: 'Komparativ und Superlativ' },
    blurb: { hu: 'Más que, menos que, tan como, el más, -ísimo.', en: 'Más que, menos que, tan como, el más, -ísimo.', es: 'Más que, menos que, tan como, el más, -ísimo.', de: 'Más que, menos que, tan como, el más, -ísimo.' },
  },
  {
    id: 'indefinidos',
    level: 'A2',
    unit: 'a2-comparar',
    title: { hu: 'Határozatlan szavak: algo, alguien, algún', en: 'Indefinites: algo, alguien, algún', es: 'Indefinidos: algo, alguien, algún', de: 'Indefinitpronomen: algo, alguien, algún' },
    blurb: { hu: 'És a tagadó párjuk: nada, nadie, ningún.', en: 'And their negative pairs: nada, nadie, ningún.', es: 'Y sus pares negativos: nada, nadie, ningún.', de: 'Und ihre verneinten Paare: nada, nadie, ningún.' },
  },
  {
    id: 'por-para',
    level: 'A2',
    unit: 'a2-comparar',
    title: { hu: 'Por vagy para?', en: 'Por or para?', es: '¿Por o para?', de: 'Por oder para?' },
    blurb: { hu: 'Ok vagy cél: a magyarban mindkettő „-ért".', en: 'Cause or purpose, where English blurs them into "for".', es: 'Causa o finalidad.', de: 'Ursache oder Ziel, beides „für".' },
  },
  {
    id: 'saber-conocer',
    level: 'A2',
    unit: 'a2-verbos',
    title: { hu: 'Saber vagy conocer?', en: 'Saber or conocer?', es: '¿Saber o conocer?', de: 'Saber oder conocer?' },
    blurb: { hu: 'Tudni egy tényt vagy ismerni valakit.', en: 'Knowing a fact or being acquainted with someone.', es: 'Saber un dato o conocer a alguien.', de: 'Eine Tatsache wissen oder jemanden kennen.' },
  },
  {
    id: 'pedir-preguntar',
    level: 'A2',
    unit: 'a2-verbos',
    title: { hu: 'Pedir vagy preguntar?', en: 'Pedir or preguntar?', es: '¿Pedir o preguntar?', de: 'Pedir oder preguntar?' },
    blurb: { hu: 'Kérni valamit vagy kérdezni valamit.', en: 'Asking FOR something or asking a question.', es: 'Pedir algo o hacer una pregunta.', de: 'Um etwas bitten oder etwas fragen.' },
  },
  {
    id: 'llevar-traer-ir-venir',
    level: 'A2',
    unit: 'a2-verbos',
    title: { hu: 'Llevar, traer, ir, venir', en: 'Llevar, traer, ir, venir', es: 'Llevar, traer, ir, venir', de: 'Llevar, traer, ir, venir' },
    blurb: { hu: 'A beszélő nézőpontja dönti el, melyik kell.', en: 'The speaker\'s point of view decides which one.', es: 'El punto de vista del hablante decide.', de: 'Der Standpunkt des Sprechers entscheidet.' },
  },
  // ========================= B1 =========================
  {
    id: 'subjuntivo-presente-forma',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { hu: 'Kötőmód jelen: az alakok', en: 'Present subjunctive: the forms', es: 'Presente de subjuntivo: las formas', de: 'Subjuntivo Präsens: die Formen' },
    blurb: { hu: 'Hable, coma, viva: a fordított végződések.', en: 'Hable, coma, viva: the swapped endings.', es: 'Hable, coma, viva: las terminaciones cambiadas.', de: 'Hable, coma, viva: die getauschten Endungen.' },
  },
  {
    id: 'subjuntivo-disparadores',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { hu: 'Mi hívja elő a kötőmódot', en: 'What triggers the subjunctive', es: 'Qué exige subjuntivo', de: 'Was den Subjuntivo auslöst' },
    blurb: { hu: 'Akarat, érzelem, kétely, tagadott vélemény.', en: 'Wish, emotion, doubt, denied opinion.', es: 'Deseo, emoción, duda, opinión negada.', de: 'Wunsch, Gefühl, Zweifel, verneinte Meinung.' },
  },
  {
    id: 'ojala-quizas',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { hu: 'Ojalá, quizás, tal vez', en: 'Ojalá, quizás, tal vez', es: 'Ojalá, quizás, tal vez', de: 'Ojalá, quizás, tal vez' },
    blurb: { hu: 'Remény és bizonytalanság kifejezése.', en: 'Expressing hope and uncertainty.', es: 'Expresar esperanza e incertidumbre.', de: 'Hoffnung und Unsicherheit ausdrücken.' },
  },
  {
    id: 'temporales-subjuntivo',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { hu: 'Cuando + kötőmód', en: 'Cuando + subjunctive', es: 'Cuando + subjuntivo', de: 'Cuando + Subjuntivo' },
    blurb: { hu: 'Jövőbeli időhatározó: cuando llegues, no llegas.', en: 'Future time clauses: cuando llegues, not llegas.', es: 'Temporales de futuro: cuando llegues.', de: 'Zukünftige Temporalsätze: cuando llegues.' },
  },
  {
    id: 'condicional-simple',
    level: 'B1',
    unit: 'b1-condicional',
    title: { hu: 'Feltételes mód', en: 'The conditional', es: 'El condicional simple', de: 'Der Konditional' },
    blurb: { hu: 'Hablaría: udvariasság, tanács, feltétel.', en: 'Hablaría: politeness, advice, hypothesis.', es: 'Hablaría: cortesía, consejo, hipótesis.', de: 'Hablaría: Höflichkeit, Rat, Annahme.' },
  },
  {
    id: 'condicionales-tipo1',
    level: 'B1',
    unit: 'b1-condicional',
    title: { hu: 'Si + jelen: valós feltétel', en: 'Si + present: real conditions', es: 'Si + presente: condicional real', de: 'Si + Präsens: reale Bedingung' },
    blurb: { hu: 'Si tengo tiempo, voy: ami tényleg megtörténhet.', en: 'Si tengo tiempo, voy: what can really happen.', es: 'Si tengo tiempo, voy: lo que puede pasar.', de: 'Si tengo tiempo, voy: was wirklich passieren kann.' },
  },
  {
    id: 'pluscuamperfecto',
    level: 'B1',
    unit: 'b1-condicional',
    title: { hu: 'Régmúlt (pluscuamperfecto)', en: 'The past perfect', es: 'El pluscuamperfecto', de: 'Das Plusquamperfekt' },
    blurb: { hu: 'Había comido: ami egy másik múlt előtt történt.', en: 'Había comido: what happened before another past.', es: 'Había comido: antes de otro pasado.', de: 'Había comido: vor einer anderen Vergangenheit.' },
  },
  {
    id: 'relativos',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { hu: 'Vonatkozó névmások: que, quien, donde', en: 'Relative pronouns: que, quien, donde', es: 'Relativos: que, quien, donde', de: 'Relativpronomen: que, quien, donde' },
    blurb: { hu: 'Két mondat összekötése egy szóval.', en: 'Joining two sentences with one word.', es: 'Unir dos frases con una palabra.', de: 'Zwei Sätze mit einem Wort verbinden.' },
  },
  {
    id: 'se-impersonal-pasiva',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { hu: 'Se: személytelen és passzív', en: 'Se: impersonal and passive', es: 'Se impersonal y pasiva refleja', de: 'Se: unpersönlich und Passiv' },
    blurb: { hu: 'Se habla español, se venden casas.', en: 'Se habla español, se venden casas.', es: 'Se habla español, se venden casas.', de: 'Se habla español, se venden casas.' },
  },
  {
    id: 'perifrasis',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { hu: 'Igei körülírások', en: 'Verb periphrases', es: 'Perífrasis verbales', de: 'Verbalperiphrasen' },
    blurb: { hu: 'Empezar a, acabar de, volver a, seguir + gerundio.', en: 'Empezar a, acabar de, volver a, seguir + gerund.', es: 'Empezar a, acabar de, volver a, seguir + gerundio.', de: 'Empezar a, acabar de, volver a, seguir + Gerundium.' },
  },
  {
    id: 'por-para-avanzado',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { hu: 'Por és para: haladó esetek', en: 'Por and para: advanced uses', es: 'Por y para: usos avanzados', de: 'Por und para: fortgeschritten' },
    blurb: { hu: 'Állandósult kifejezések és a nehéz határesetek.', en: 'Set phrases and the genuinely hard cases.', es: 'Expresiones fijas y los casos difíciles.', de: 'Feste Wendungen und die harten Fälle.' },
  },
  // ========================= B2 =========================
  {
    id: 'subjuntivo-imperfecto',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { hu: 'Kötőmód múlt (imperfecto de subjuntivo)', en: 'Imperfect subjunctive', es: 'Imperfecto de subjuntivo', de: 'Subjuntivo Imperfekt' },
    blurb: { hu: 'Hablara / hablase: múltbeli akarat és feltétel.', en: 'Hablara / hablase: past wishes and conditions.', es: 'Hablara / hablase: deseos y condiciones en pasado.', de: 'Hablara / hablase: Wünsche und Bedingungen.' },
  },
  {
    id: 'subjuntivo-perfecto',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { hu: 'Kötőmód összetett alakjai', en: 'Perfect subjunctive forms', es: 'Subjuntivo compuesto', de: 'Zusammengesetzter Subjuntivo' },
    blurb: { hu: 'Haya hablado, hubiera hablado.', en: 'Haya hablado, hubiera hablado.', es: 'Haya hablado, hubiera hablado.', de: 'Haya hablado, hubiera hablado.' },
  },
  {
    id: 'condicionales-tipo2-3',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { hu: 'Irreális feltétel: si tuviera, si hubiera', en: 'Unreal conditions: si tuviera, si hubiera', es: 'Condicionales irreales', de: 'Irreale Bedingungssätze' },
    blurb: { hu: 'Ami nem igaz, és ami már nem lehet igaz.', en: 'What is not true, and what can no longer be.', es: 'Lo que no es y lo que ya no puede ser.', de: 'Was nicht ist und nicht mehr sein kann.' },
  },
  {
    id: 'estilo-indirecto',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'Függő beszéd', en: 'Reported speech', es: 'Estilo indirecto', de: 'Indirekte Rede' },
    blurb: { hu: 'Dijo que venía: az igeidő-eltolás szabálya.', en: 'Dijo que venía: the tense shift.', es: 'Dijo que venía: el cambio de tiempos.', de: 'Dijo que venía: die Zeitverschiebung.' },
  },
  {
    id: 'pasiva-ser-participio',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'Passzív: ser + participio', en: 'Passive: ser + participle', es: 'Pasiva con ser + participio', de: 'Passiv: ser + Partizip' },
    blurb: { hu: 'És miért ritkább a spanyolban, mint az angolban.', en: 'And why it is rarer in Spanish than in English.', es: 'Y por qué es menos frecuente que en inglés.', de: 'Und warum es seltener ist als im Englischen.' },
  },
  {
    id: 'concesivas',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'Megengedés: aunque, a pesar de', en: 'Concession: aunque, a pesar de', es: 'Concesivas: aunque, a pesar de', de: 'Konzessivsätze: aunque, a pesar de' },
    blurb: { hu: 'Aunque + kijelentő vagy kötőmód, más jelentéssel.', en: 'Aunque with indicative or subjunctive, different meanings.', es: 'Aunque con indicativo o subjuntivo.', de: 'Aunque mit Indikativ oder Subjuntivo.' },
  },
  {
    id: 'finales-causales',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'Cél és ok: para que, porque, ya que', en: 'Purpose and cause: para que, porque, ya que', es: 'Finales y causales', de: 'Final- und Kausalsätze' },
    blurb: { hu: 'Para que + kötőmód, porque + kijelentő.', en: 'Para que + subjunctive, porque + indicative.', es: 'Para que + subjuntivo, porque + indicativo.', de: 'Para que + Subjuntivo, porque + Indikativ.' },
  },
  {
    id: 'lo-neutro',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'A semleges lo', en: 'The neuter lo', es: 'El lo neutro', de: 'Das neutrale lo' },
    blurb: { hu: 'Lo importante, lo que dijiste, lo bien que canta.', en: 'Lo importante, lo que dijiste, lo bien que canta.', es: 'Lo importante, lo que dijiste, lo bien que canta.', de: 'Lo importante, lo que dijiste, lo bien que canta.' },
  },
  {
    id: 'gerundio-participio-construcciones',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { hu: 'Gerundio és participio szerkezetek', en: 'Gerund and participle constructions', es: 'Construcciones de gerundio y participio', de: 'Gerundium- und Partizipkonstruktionen' },
    blurb: { hu: 'Siendo, hecho esto, llevar + gerundio.', en: 'Siendo, hecho esto, llevar + gerund.', es: 'Siendo, hecho esto, llevar + gerundio.', de: 'Siendo, hecho esto, llevar + Gerundium.' },
  },
  // ========================= C1 =========================
  {
    id: 'futuro-condicional-perfecto',
    level: 'C1',
    unit: 'c1-matices',
    title: { hu: 'Befejezett jövő és feltételes', en: 'Future and conditional perfect', es: 'Futuro y condicional perfecto', de: 'Futur II und Konditional II' },
    blurb: { hu: 'Habré terminado, habría dicho.', en: 'Habré terminado, habría dicho.', es: 'Habré terminado, habría dicho.', de: 'Habré terminado, habría dicho.' },
  },
  {
    id: 'probabilidad-con-tiempos',
    level: 'C1',
    unit: 'c1-matices',
    title: { hu: 'Valószínűség igeidőkkel', en: 'Probability through tenses', es: 'La probabilidad con los tiempos', de: 'Wahrscheinlichkeit durch Zeiten' },
    blurb: { hu: 'Serán las tres: a jövő idő mint találgatás.', en: 'Serán las tres: the future used as a guess.', es: 'Serán las tres: el futuro como conjetura.', de: 'Serán las tres: Futur als Vermutung.' },
  },
  {
    id: 'relativos-complejos',
    level: 'C1',
    unit: 'c1-matices',
    title: { hu: 'Összetett vonatkozó szerkezetek', en: 'Complex relative clauses', es: 'Relativos complejos', de: 'Komplexe Relativsätze' },
    blurb: { hu: 'El cual, cuyo, en el que: írott regiszter.', en: 'El cual, cuyo, en el que: the written register.', es: 'El cual, cuyo, en el que: registro escrito.', de: 'El cual, cuyo, en el que: Schriftsprache.' },
  },
  {
    id: 'leismo-laismo',
    level: 'C1',
    unit: 'c1-matices',
    title: { hu: 'Leísmo és laísmo', en: 'Leísmo and laísmo', es: 'Leísmo y laísmo', de: 'Leísmo und laísmo' },
    blurb: { hu: 'Mit fogadnak el, és mi számít hibának.', en: 'What is accepted and what counts as an error.', es: 'Qué se acepta y qué es error.', de: 'Was akzeptiert wird und was als Fehler gilt.' },
  },
  {
    id: 'marcadores-discursivos',
    level: 'C1',
    unit: 'c1-matices',
    title: { hu: 'Szövegkötő elemek', en: 'Discourse markers', es: 'Marcadores discursivos', de: 'Diskursmarker' },
    blurb: { hu: 'Sin embargo, por lo tanto, en cuanto a.', en: 'Sin embargo, por lo tanto, en cuanto a.', es: 'Sin embargo, por lo tanto, en cuanto a.', de: 'Sin embargo, por lo tanto, en cuanto a.' },
  },
];

export const SYLLABUS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/**
 * game_progress key for the course. Deliberately NOT 'grammar-choice': the
 * Game tab's drill and the course are different activities, and a topic
 * played as a game should not tick itself off the syllabus.
 */
export const GRAMMAR_PROGRESS_KEY = 'grammar-course';

export function syllabusForLevel(level: Level): SyllabusTopic[] {
  return GRAMMAR_SYLLABUS.filter((t) => t.level === level);
}

export function unitsForLevel(level: Level): SyllabusUnit[] {
  return GRAMMAR_UNITS.filter((u) => u.level === level);
}

export function topicsForUnit(unitId: string): SyllabusTopic[] {
  return GRAMMAR_SYLLABUS.filter((t) => t.unit === unitId);
}

export function syllabusTopic(id: string): SyllabusTopic | undefined {
  return GRAMMAR_SYLLABUS.find((t) => t.id === id);
}

/** The authored lesson for a syllabus entry, if it has been written yet. */
export function lessonFor(lang: string, topicId: string): GrammarTopicData | undefined {
  return getGrammarTopic(lang, topicId);
}

export function hasLesson(lang: string, topicId: string): boolean {
  return !!getGrammarTopic(lang, topicId);
}

/** How much of the syllabus is written, for the header line. */
export function lessonCoverage(lang: string): { written: number; planned: number } {
  const planned = GRAMMAR_SYLLABUS.length;
  const written = GRAMMAR_SYLLABUS.filter((t) => hasLesson(lang, t.id)).length;
  return { written, planned };
}

/**
 * Authored lessons that are NOT in the syllabus map. Any such topic would be
 * unreachable from the study screen, so the test suite fails on it rather than
 * letting the content go quietly missing.
 */
export function orphanLessons(lang: string): string[] {
  const ids = new Set(GRAMMAR_SYLLABUS.map((t) => t.id));
  return getGrammarTopics(lang)
    .map((t) => t.topic)
    .filter((id) => !ids.has(id));
}
