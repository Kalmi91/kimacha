// GAMES.md 3. (F0): single source of truth for every game on the Game tab
// (GAMES.md 1. szekció, the user-approved list). The hub screen
// (app/(tabs)/games.tsx) draws its card grid from this array, a new game is
// one registry entry + one app/games/<id>.tsx screen, nothing else.
//
// F0 builds the frame only (GAMES.md 5. szekció, F0 sorban a legelső), no
// game screen exists yet, so every entry is `soon: true`. A later phase
// flips a single game's `soon` to false the day its screen ships.

export type GameId =
  | 'word-rain'
  | 'bubble-pop'
  | 'memory-pairs'
  | 'word-search'
  | 'story'
  | 'chat'
  | 'conjugation-slot'
  | 'odd-one-out'
  | 'sentence-tetris'
  | 'ccat'
  | 'grammar-choice'
  | 'confusables'
  | 'myth';

export type GameKind =
  | 'arcade'
  | 'arcade-category'
  | 'puzzle'
  | 'content'
  | 'content-decision'
  | 'grammar-drill'
  | 'logic'
  | 'arcade-word-order'
  | 'test-prep'
  | 'grammar-teaching'
  | 'teaching-drill'
  | 'content-facts';

// GAMES.md 5. szekció (Építési sorrend javaslat).
export type BuildPhase = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export interface LocalizedText {
  hu: string;
  en: string;
  es: string;
  de: string;
}

export interface GameDef {
  id: GameId;
  icon: string; // emoji, no react-native-svg (K17)
  kind: GameKind;
  phase: BuildPhase;
  name: LocalizedText;
  blurb: LocalizedText; // one-liner, "mit gyakorolsz vele" a hub kártyán
  // Minimum getLearnedPool() size to unlock the game. undefined = content-
  // driven (story/chat/grammar-choice/confusables/myth): gated by whether the
  // level's authored content exists, not by a raw word count.
  minPoolSize?: number;
  hasSettings: boolean; // gear icon a hub kártyán (GAMES.md 2.2)
  // Nincs képernyője még, a hub "hamarosan" állapotban mutatja, koppintás
  // nem navigál. Az F1-től induló fázisok ezt egyenként állítják false-ra.
  soon: boolean;
}

export const GAME_DEFS: GameDef[] = [
  {
    id: 'word-rain',
    icon: '🌧️',
    kind: 'arcade',
    phase: 'F2',
    name: { hu: 'Szó-eső', en: 'Word Rain', es: 'Lluvia de Palabras', de: 'Wortregen' },
    blurb: {
      hu: 'Gyors felismerés: kapd el a jó szót, mielőtt leesik.',
      en: 'Quick recognition: catch the right word before it falls.',
      es: 'Reconocimiento rápido: atrapa la palabra correcta antes de que caiga.',
      de: 'Schnelles Erkennen: fang das richtige Wort, bevor es fällt.',
    },
    minPoolSize: 20,
    hasSettings: true,
    soon: false, // F2 (GAMES.md 8. szekció): app/games/word-rain.tsx
  },
  {
    id: 'bubble-pop',
    icon: '🫧',
    kind: 'arcade-category',
    phase: 'F2',
    name: { hu: 'Buborék-pukkasztó', en: 'Bubble Pop', es: 'Revienta Burbujas', de: 'Blasen-Platzer' },
    blurb: {
      hu: 'Pukkaszd ki a kategóriába illő szavakat.',
      en: 'Pop the words that fit the category.',
      es: 'Revienta las palabras que encajan en la categoría.',
      de: 'Zerplatze die Wörter, die zur Kategorie passen.',
    },
    minPoolSize: 16,
    hasSettings: true,
    soon: false, // F2 (GAMES.md 8. szekció): app/games/bubble-pop.tsx
  },
  {
    id: 'memory-pairs',
    icon: '🃏',
    kind: 'puzzle',
    phase: 'F1',
    name: { hu: 'Memóriapárosító', en: 'Memory Pairs', es: 'Parejas de Memoria', de: 'Memory-Paare' },
    blurb: {
      hu: 'Passzív felidézés párkereséssel, nulla időnyomás.',
      en: 'Passive recall with a matching game, zero time pressure.',
      es: 'Recuerdo pasivo emparejando cartas, sin presión de tiempo.',
      de: 'Passives Erinnern durch Paare finden, ohne Zeitdruck.',
    },
    minPoolSize: 12,
    hasSettings: true,
    soon: false, // F1 (GAMES.md 8. szekció): app/games/memory-pairs.tsx
  },
  {
    id: 'word-search',
    icon: '🔍',
    kind: 'puzzle',
    phase: 'F1',
    name: { hu: 'Szókereső rács', en: 'Word Search', es: 'Sopa de Letras', de: 'Wortsuche' },
    blurb: {
      hu: 'Keresd meg a szót a betűrácsban a jelentése alapján.',
      en: 'Find the word in the letter grid from its meaning.',
      es: 'Busca la palabra en la cuadrícula a partir de su significado.',
      de: 'Finde das Wort im Buchstabenraster anhand seiner Bedeutung.',
    },
    minPoolSize: 10,
    hasSettings: true,
    soon: false, // F1 (GAMES.md 8. szekció): app/games/word-search.tsx
  },
  {
    id: 'story',
    icon: '📖',
    kind: 'content',
    phase: 'F4',
    name: { hu: 'Sztori-mód', en: 'Story Mode', es: 'Modo Historia', de: 'Geschichten-Modus' },
    blurb: {
      hu: 'Olvass egy jelenetekre bontott történetet, koppints az új szavakra.',
      en: 'Read a story scene by scene, tap any new word for its meaning.',
      es: 'Lee una historia por escenas, toca cualquier palabra nueva.',
      de: 'Lies eine Geschichte szenenweise, tippe auf neue Wörter.',
    },
    hasSettings: true,
    soon: false, // F4 (GAMES.md 8. szekció): app/games/story.tsx
  },
  {
    id: 'chat',
    icon: '💬',
    kind: 'content-decision',
    phase: 'F4',
    name: { hu: 'Tanácsadó beszélgetés', en: 'Advisor Chat', es: 'Chat Consejero', de: 'Beratungs-Chat' },
    blurb: {
      hu: 'Dönts egy valós élethelyzetben, tanuld meg, mit kell kérdezned.',
      en: 'Make choices in a real-life situation, learn what to ask.',
      es: 'Toma decisiones en una situación real, aprende qué preguntar.',
      de: 'Triff Entscheidungen in einer echten Situation, lerne, was zu fragen ist.',
    },
    hasSettings: false,
    soon: false, // F4 (GAMES.md 8. szekció): app/games/chat.tsx
  },
  {
    id: 'conjugation-slot',
    icon: '🧩',
    kind: 'grammar-drill',
    phase: 'F5',
    name: { hu: 'Ragozás-slot', en: 'Conjugation Slot', es: 'Ranura de Conjugación', de: 'Konjugations-Slot' },
    blurb: {
      hu: 'Válaszd ki a helyes igealakot, gyors tempóban.',
      en: 'Pick the correct verb form, fast.',
      es: 'Elige la forma verbal correcta, rápido.',
      de: 'Wähle die richtige Verbform, schnell.',
    },
    minPoolSize: 10,
    hasSettings: true,
    soon: true,
  },
  {
    id: 'odd-one-out',
    icon: '🧠',
    kind: 'logic',
    phase: 'F5',
    name: { hu: 'Kakukktojás', en: 'Odd One Out', es: 'El Intruso', de: 'Der Außenseiter' },
    blurb: {
      hu: 'Találd meg, melyik szó lóg ki a négy közül.',
      en: "Find which of the four words doesn't belong.",
      es: 'Encuentra cuál de las cuatro palabras no encaja.',
      de: 'Finde heraus, welches der vier Wörter nicht passt.',
    },
    minPoolSize: 16,
    hasSettings: true,
    soon: true,
  },
  {
    id: 'sentence-tetris',
    icon: '🧱',
    kind: 'arcade-word-order',
    phase: 'F6',
    name: { hu: 'Mondat-Tetris', en: 'Sentence Tetris', es: 'Tetris de Frases', de: 'Satz-Tetris' },
    blurb: {
      hu: 'Rakd a helyére az eső szó-blokkokat, mielőtt betelik a sor.',
      en: 'Drop the falling word blocks into place before the row fills up.',
      es: 'Coloca los bloques de palabras antes de que se llene la fila.',
      de: 'Setze die fallenden Wortblöcke, bevor die Reihe voll ist.',
    },
    minPoolSize: 20,
    hasSettings: true,
    // K16 DÖNTÉS: marad a legvégén, az F6 fázis nem indul el a többi előtt.
    soon: true,
  },
  {
    id: 'ccat',
    icon: '🎯',
    kind: 'test-prep',
    phase: 'F5',
    name: { hu: 'CCAT-felkészítő', en: 'CCAT Prep', es: 'Preparación CCAT', de: 'CCAT-Vorbereitung' },
    blurb: {
      hu: 'Vegyes szókincs- és logika-kérdések, gyors tempóban.',
      en: 'Mixed vocabulary and logic questions, fast-paced.',
      es: 'Preguntas mixtas de vocabulario y lógica, a ritmo rápido.',
      de: 'Gemischte Wortschatz- und Logikfragen im schnellen Tempo.',
    },
    minPoolSize: 30,
    hasSettings: true,
    soon: true,
  },
  {
    id: 'grammar-choice',
    icon: '✅',
    kind: 'grammar-teaching',
    phase: 'F3',
    name: { hu: '„Melyik a helyes?"', en: '"Which Is Correct?"', es: '"¿Cuál Es Correcta?"', de: '"Was Ist Richtig?"' },
    blurb: {
      hu: 'Válaszd ki a helyes mondatot, és értsd is meg, miért.',
      en: 'Pick the grammatically correct sentence, and understand why.',
      es: 'Elige la frase correcta y entiende por qué.',
      de: 'Wähle den richtigen Satz und verstehe, warum.',
    },
    hasSettings: false,
    soon: false, // F3 (GAMES.md 8. szekció): app/games/grammar-choice.tsx
  },
  {
    id: 'confusables',
    icon: '🔀',
    kind: 'teaching-drill',
    phase: 'F3',
    name: { hu: 'Hasonló szavak', en: 'Confusables', es: 'Palabras Confusas', de: 'Verwechslungswörter' },
    blurb: {
      hu: 'Tanuld meg megkülönböztetni a könnyen összekeverhető szavakat.',
      en: 'Learn to tell apart words that are easy to mix up.',
      es: 'Aprende a distinguir palabras que se confunden fácilmente.',
      de: 'Lerne, leicht verwechselbare Wörter zu unterscheiden.',
    },
    hasSettings: false,
    soon: false, // F3 (GAMES.md 8. szekció): app/games/confusables.tsx
  },
  {
    id: 'myth',
    icon: '🤔',
    kind: 'content-facts',
    phase: 'F4',
    name: { hu: 'Igaz vagy kamu?', en: 'True or Myth?', es: '¿Mito o Realidad?', de: 'Wahr oder Mythos?' },
    blurb: {
      hu: 'Tippelj, igaz-e az állítás, aztán tudd meg a választ.',
      en: 'Guess if the claim is true, then find out the answer.',
      es: 'Adivina si la afirmación es verdadera, y descubre la respuesta.',
      de: 'Rate, ob die Aussage wahr ist, und finde die Antwort heraus.',
    },
    minPoolSize: undefined,
    hasSettings: true,
    soon: false, // F4 (GAMES.md 8. szekció): app/games/myth.tsx
  },
];

export function getGameDefs(): GameDef[] {
  return GAME_DEFS;
}

export function getGameDef(id: GameId): GameDef | undefined {
  return GAME_DEFS.find((g) => g.id === id);
}

export function gameRoute(id: GameId): string {
  return `/games/${id}`;
}

// Game names/blurbs are CONTENT (same status as data/topics.ts TopicDef
// name_*), so they follow the pair's native language (direction[0]/"content
// lang", see app/(tabs)/tree.tsx's uiLang), not the app-chrome language t()
// reads, a learner can study Spanish from English on a Hungarian phone, and
// the game names should read in English, not Hungarian, in that case.
function localized(text: LocalizedText, lang: string): string {
  const key = (lang === 'hu' || lang === 'es' || lang === 'de' ? lang : 'en') as keyof LocalizedText;
  return text[key] ?? text.en;
}

export function gameName(game: GameDef, lang: string): string {
  return localized(game.name, lang);
}

export function gameBlurb(game: GameDef, lang: string): string {
  return localized(game.blurb, lang);
}
