// PLAN-vizsga C. szakasz (Kálmán, 2026-10-01, C2 b): a szintfelmérő kérdései. Szót ÉS
// nyelvtant mér: a szó a szint words-open kártyáiból jön (a kérdés a célnyelvi szó, a
// válasz a kiinduló nyelvű jelentés, négy közül), a nyelvtan a szint nyelvtani leckéinek
// lyukas-mondat tételeiből (lib/exam/grammarItems.ts), a leckék KÉSZ voltától függetlenül.
// A szó-kérdésben nincs mondat (észak-csillag: soha mondat ismeretlen szóval); a lecke
// mondatai a lecke saját, auditált tételei. Tiszta modul: a hívó adja az adatot.

import { PCIC_LEVELS, pcicItemsForLevel, type PcicItem, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { gapSourcesForLevel, type GapSource } from './grammarItems';

/** Egy lépcső (5 kérdés) sorrendje: szó, nyelvtan, szó, nyelvtan, szó. */
export const PLACEMENT_PATTERN = ['word', 'gap', 'word', 'gap', 'word'] as const;
type PlacementKind = (typeof PLACEMENT_PATTERN)[number];

/** Szó-kérdés: a válaszlehetőségek (4) a kiinduló nyelvű jelentések. */
export interface PlacementWordQuestion {
  kind: 'word';
  level: PcicLevel;
  itemId: string;
  word: string;
  options: string[];
  correctIndex: number;
}

/** Nyelvtan-kérdés: lyukas mondat, a lecke tételéből. */
export interface PlacementGapQuestion {
  kind: 'gap';
  level: PcicLevel;
  topicId: string;
  itemId: string;
  sentence: string;
  options: string[];
  correctIndex: number;
}

export type PlacementQuestion = PlacementWordQuestion | PlacementGapQuestion;

/** Egy szint kérdés-készlete. */
export interface PlacementPool {
  items: PcicItem[];
  gaps: GapSource[];
}

const WORD_OPTIONS = 4;

export function placementQuestionKey(q: PlacementQuestion): string {
  return q.kind === 'word' ? `w:${q.itemId}` : `g:${q.topicId}:${q.itemId}`;
}

/** A mérhető szintek: amihez van szó-adat az aktív irányban (a hívó előtte `setPcicTarget`-et hív). */
export function placementLevels(): PcicLevel[] {
  return PCIC_LEVELS.filter((level) => pcicItemsForLevel(level).length > 0);
}

/** Egy szint készlete az aktív irányhoz: a szint szavai + MINDEN megírt nyelvtani lecke gap tétele. */
export function placementPoolFor(level: PcicLevel, target: PcicTarget): PlacementPool {
  const topicIds = syllabusForLevel(level, target)
    .map((topic) => topic.id)
    .filter((id) => hasLesson(target, id));
  return { items: pcicItemsForLevel(level), gaps: gapSourcesForLevel(level, target, topicIds) };
}

const norm = (text: string) => text.trim().toLowerCase();

interface WordSides {
  /** A kérdezett (célnyelvi) szó. */
  word: string;
  /** A jó válasz (kiinduló nyelvű jelentés). */
  meaning: string;
}

function sidesOf(item: PcicItem, target: PcicTarget): WordSides | undefined {
  const word = (target === 'es' ? item.es : item.en)?.split(' / ')[0]?.trim();
  const meaning = (target === 'es' ? item.en : item.es)?.trim();
  return word && meaning ? { word, meaning } : undefined;
}

function wordQuestion(level: PcicLevel, item: PcicItem, items: PcicItem[], target: PcicTarget, seed: number): PlacementWordQuestion | undefined {
  const own = sidesOf(item, target);
  if (!own) return undefined;
  // Csapdák: más jelentés, azonos szófajjal előre (hihetőbb), de a kérdezett szóval vagy a jó
  // válasszal azonos szöveg nem lehet köztük (azonos írású szó / szinonim-jelölt = két jó válasz).
  const taken = new Set([norm(own.meaning)]);
  // Az azonos írású másik szó jelentése is jó válasz lenne: az sem csapda.
  for (const other of items) {
    const sides = sidesOf(other, target);
    if (sides && norm(sides.word) === norm(own.word)) taken.add(norm(sides.meaning));
  }
  const candidates = shuffleArray(
    items.filter((other) => other.id !== item.id),
    hashString(`wd:${seed}:${item.id}`),
  );
  const samePos = candidates.filter((other) => item.pos && other.pos === item.pos);
  const rest = candidates.filter((other) => !(item.pos && other.pos === item.pos));
  const distractors: string[] = [];
  for (const other of [...samePos, ...rest]) {
    if (distractors.length >= WORD_OPTIONS - 1) break;
    const sides = sidesOf(other, target);
    if (!sides || norm(sides.word) === norm(own.word) || taken.has(norm(sides.meaning))) continue;
    taken.add(norm(sides.meaning));
    distractors.push(sides.meaning);
  }
  if (distractors.length < WORD_OPTIONS - 1) return undefined;
  const { options, correctIndex } = shuffleOptions([own.meaning, ...distractors], 0, hashString(`wo:${seed}:${item.id}`));
  return { kind: 'word', level, itemId: item.id, word: own.word, options, correctIndex };
}

function gapQuestion(level: PcicLevel, gap: GapSource, seed: number): PlacementGapQuestion {
  const { options, correctIndex } = shuffleOptions(gap.options, gap.correct, hashString(`gp:${seed}:${gap.topicId}:${gap.itemId}`));
  return { kind: 'gap', level, topicId: gap.topicId, itemId: gap.itemId, sentence: gap.sentence, options, correctIndex };
}

interface BuildPlacementInput {
  level: PcicLevel;
  /** A kérdés helye a lépcsőn belül (0..4): a PLACEMENT_PATTERN dönti el a fajtát. */
  position: number;
  target: PcicTarget;
  pool: PlacementPool;
  /** Már feltett kérdések (placementQuestionKey), hogy ugyanaz ne jöjjön kétszer. */
  used: ReadonlySet<string>;
  seed: number;
}

/**
 * A következő kérdés. Ha a kért fajtából elfogyott a készlet (pl. a szinthez nincs megírt
 * lecke), a másik fajtából ad; ha mindkettőből elfogyott, `undefined`.
 */
export function buildPlacementQuestion(input: BuildPlacementInput): PlacementQuestion | undefined {
  const { level, position, target, pool, used, seed } = input;
  const wanted: PlacementKind = PLACEMENT_PATTERN[position % PLACEMENT_PATTERN.length];
  const salt = `${seed}:${level}:${used.size}`;

  const nextWord = (): PlacementWordQuestion | undefined => {
    for (const item of shuffleArray(pool.items, hashString(`pw:${salt}`))) {
      if (used.has(`w:${item.id}`)) continue;
      const q = wordQuestion(level, item, pool.items, target, seed);
      if (q) return q;
    }
    return undefined;
  };
  const nextGap = (): PlacementGapQuestion | undefined => {
    const gap = shuffleArray(pool.gaps, hashString(`pg:${salt}`)).find((g) => !used.has(`g:${g.topicId}:${g.itemId}`));
    return gap ? gapQuestion(level, gap, seed) : undefined;
  };

  return wanted === 'word' ? (nextWord() ?? nextGap()) : (nextGap() ?? nextWord());
}
