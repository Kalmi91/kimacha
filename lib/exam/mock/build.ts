// PLAN-vizsga E. szakasz (15-16. lépés, Kálmán E5 c): a próbavizsga feladatsorának építője.
// A régi (4afeb8c^) lib/exam/buildMockExam.ts kézzel írt JSON-ból és a régi szókészletből
// épített; ez a szint szavaiból (a hívó adja a `pcicItemsForLevel` tételeit) és a tételek
// példamondataiból. A tanult-állapot NEM számít: a feladatsor a szint szavaiból áll, az
// ismeretlen szóhoz a felület szójegyzetet ad (lib/exam/mock/glossary.ts). Ugyanaz a seed
// ugyanazt a vizsgát adja (a részenkénti mentés ebből tud folytatni).
//
// Tiszta modul: nincs adatbázis, nincs betöltött korpusz, a hívó adja az adatot.

import type { PcicItem } from '@/data/pcic';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { mockInstruction, MOCK_WRITING, type MockInstructionKind } from './author';
import { getMockBlueprint } from './blueprint';
import type {
  MockExam,
  MockGapMcTask,
  MockLevel,
  MockListenTask,
  MockMatchTask,
  MockPaper,
  MockReadMcTask,
  MockTarget,
  MockTask,
  MockTrueFalseTask,
} from './types';

export interface MockBuildInput {
  target: MockTarget;
  level: MockLevel;
  /** A szint kártyái (`pcicItemsForLevel`, az aktív irányé). */
  items: PcicItem[];
  seed: number;
}

interface Sentence {
  itemId: string;
  source: string;
  target: string;
}

const MIN_WORDS = 3;
const PUNCT = /[¿?¡!.,;:()"«»]/g;
const ARTICLE: Record<MockTarget, RegExp> = {
  es: /^(el|la|los|las|un|una)\s+/i,
  en: /^(to|the|a|an)\s+/i,
};

export function sentenceWords(sentence: string): string[] {
  return sentence.replace(PUNCT, ' ').split(/\s+/).filter(Boolean);
}

/** A tétel célnyelvi alakja névelő / "to" és zárójel nélkül, egy szavas formában; különben null. */
export function singleWordForm(item: PcicItem, target: MockTarget): string | null {
  const raw = (target === 'es' ? item.es : item.en).split(' / ')[0].replace(/\(.*?\)/g, '').trim();
  const bare = raw.replace(ARTICLE[target], '').trim().toLowerCase();
  if (!bare || /\s/.test(bare) || bare.length < MIN_WORDS) return null;
  return bare;
}

/** A mondatban a szó egyetlen előfordulása helyén `___`; ha nincs vagy többször van, null. */
function gapSentence(sentence: string, word: string): string | null {
  const tokens = sentence.split(/\s+/);
  const hits: number[] = [];
  tokens.forEach((tok, i) => {
    if (tok.replace(PUNCT, '').toLowerCase() === word) hits.push(i);
  });
  if (hits.length !== 1) return null;
  const m = tokens[hits[0]].match(/^([¿¡"«(]*)(.*?)([?!.,;:)"»]*)$/);
  if (!m) return null;
  tokens[hits[0]] = `${m[1]}___${m[3]}`;
  return tokens.join(' ');
}

export function buildMockExam(input: MockBuildInput): MockExam {
  const { target, level, items, seed } = input;
  const bp = getMockBlueprint(target, level);
  const c = bp.counts;
  const key = `${target}:${level}:${seed}`;
  const rank = (part: string) => hashString(`${key}:${part}`);

  // Mondat-készlet: a szint kártyáinak példamondata, a szint nyelvtanán belül (szószám-plafon),
  // a kiinduló nyelvi mondatok egyediek (nem lesz két egyforma válasz-lehetőség).
  const seenSource = new Set<string>();
  const pool: Sentence[] = [];
  for (const it of shuffleArray(items, rank('pool'))) {
    const tgt = (target === 'es' ? it.exampleEs : it.exampleEn)?.trim();
    const src = (target === 'es' ? it.exampleEn : it.exampleEs)?.trim();
    if (!tgt || !src) continue;
    const n = sentenceWords(tgt).length;
    if (n < MIN_WORDS || n > c.maxWords) continue;
    const dedupe = src.toLowerCase();
    if (seenSource.has(dedupe)) continue;
    seenSource.add(dedupe);
    const s = { itemId: it.id, source: src, target: tgt };
    pool.push(s);
  }

  const used = new Set<string>();
  const take = (n: number, from: Sentence[] = pool): Sentence[] => {
    const out: Sentence[] = [];
    for (const s of from) {
      if (out.length >= n) break;
      if (used.has(s.itemId)) continue;
      used.add(s.itemId);
      out.push(s);
    }
    return out;
  };
  // Rossz válasz-lehetőségek: bármely más mondat kiinduló nyelvi alakja (nem kell "elhasználni").
  const decoys = (avoid: Sentence[], n: number, part: string): Sentence[] => {
    const skip = new Set(avoid.map((s) => s.itemId));
    return shuffleArray(
      pool.filter((s) => !skip.has(s.itemId)),
      rank(part),
    ).slice(0, n);
  };
  const choice = (correct: string, wrong: string[], part: string) => {
    const { options, correctIndex } = shuffleOptions([correct, ...wrong], 0, rank(part));
    return { options, correct: correctIndex };
  };

  // --- Lyukas mondat: előbb, mert kevés mondat alkalmas (egy szavas, egyszer szereplő célszó).
  const gapWordOf = new Map<string, string>();
  for (const it of items) {
    const w = singleWordForm(it, target);
    if (w) gapWordOf.set(it.id, w);
  }
  // Lyukas mondat gazdája: tartalmas szó (főnév, ige, melléknév, határozó, vagy besorolatlan);
  // számnév, névmás, elöljáró és kötőszó több válaszra is illene, azok sem gazda, sem csapda.
  const AMBIGUOUS_POS = new Set(['num', 'pron', 'prep', 'conj']);
  const gaps: MockGapMcTask['gaps'] = [];
  for (const s of pool) {
    if (gaps.length >= c.readGaps) break;
    const word = gapWordOf.get(s.itemId);
    const text = word ? gapSentence(s.target, word) : null;
    if (!word || !text) continue;
    const host = items.find((i) => i.id === s.itemId);
    if (host?.pos && AMBIGUOUS_POS.has(host.pos)) continue;
    const inSentence = new Set(sentenceWords(s.target).map((w) => w.toLowerCase()));
    const others = shuffleArray(
      items.filter(
        (i) =>
          i.id !== s.itemId &&
          gapWordOf.has(i.id) &&
          !(i.pos && AMBIGUOUS_POS.has(i.pos)) &&
          gapWordOf.get(i.id) !== word &&
          !inSentence.has(gapWordOf.get(i.id)!),
      ),
      rank(`gapw:${s.itemId}`),
    );
    // Az egyik csapda azonos szófajú (hihető), a másik más szófajú (nyelvtanilag nem illik), hogy
    // ne legyen két egyformán jó válasz.
    const same = others.filter((i) => host?.pos && i.pos === host.pos);
    const diff = others.filter((i) => !(host?.pos && i.pos === host.pos));
    const picked = [same[0], diff[0], same[1], diff[1]].filter((i): i is PcicItem => !!i).slice(0, 2);
    const wrong = picked.map((i) => gapWordOf.get(i.id)!);
    if (wrong.length < 2 || new Set(wrong).size < 2) continue;
    used.add(s.itemId);
    gaps.push({ text, ...choice(word, wrong, `gap:${s.itemId}`) });
  }

  const tasks: Record<'reading' | 'listening', MockTask[]> = { reading: [], listening: [] };
  const add = (skill: 'reading' | 'listening', build: (id: string, instruction: (k: MockInstructionKind) => string) => MockTask | null) => {
    const n = tasks[skill].length + 1;
    const id = `${skill}-${n}`;
    const task = build(id, (k) => mockInstruction(target, k, n));
    if (task) tasks[skill].push(task);
  };

  // --- Olvasás 1: két mondatos szöveg, a jó válasz a két mondat kiinduló nyelvi fordítása.
  add('reading', (id, instr) => {
    const passages: MockReadMcTask['passages'] = [];
    for (let k = 0; k < c.readPassages; k++) {
      const [a, b] = take(2);
      if (!a || !b) break;
      const [x, y] = decoys([a, b], 2, `rp:${k}`);
      if (!x || !y) break;
      passages.push({ text: `${a.target} ${b.target}`, ...choice(`${a.source} ${b.source}`, [`${a.source} ${x.source}`, `${y.source} ${b.source}`], `rpo:${k}:${a.itemId}`) });
    }
    return passages.length ? { id, kind: 'read_mc', instruction: instr('read_mc'), passages } : null;
  });

  // --- Olvasás 2 és hallás 2: mondatok párosítása a jelentésükkel (egy jelentés több).
  const matchTask = (id: string, kind: 'match' | 'listen_match', instruction: string, n: number, part: string): MockMatchTask | null => {
    const picked = take(n);
    if (picked.length < 3) return null;
    const extra = decoys(picked, 1, part);
    const texts = shuffleArray([...picked.map((s) => s.source), ...extra.map((s) => s.source)], rank(`${part}:order`));
    const options = texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
    const answer: Record<string, string> = {};
    const prompts = picked.map((s, i) => {
      const pid = `p${i + 1}`;
      answer[pid] = options.find((o) => o.text === s.source)!.id;
      return { id: pid, text: kind === 'match' ? s.target : '' };
    });
    return { id, kind, instruction, ...(kind === 'listen_match' ? { audio: picked.map((s) => s.target) } : {}), prompts, options, answer };
  };
  add('reading', (id, instr) => matchTask(id, 'match', instr('match'), c.readMatch, 'rm'));

  // --- Olvasás 3: háromsoros szöveg, állítások (az igaz a szöveg mondatának fordítása, a hamis másé).
  add('reading', (id, instr) => {
    const text = take(c.readTextSentences);
    if (text.length < 2) return null;
    const nTrue = Math.min(c.readTrue, text.length);
    const wrong = decoys(text, c.readTrueFalse - nTrue, 'rtf');
    const statements = shuffleArray(
      [...text.slice(0, nTrue).map((s) => ({ s: s.source, answer: true })), ...wrong.map((s) => ({ s: s.source, answer: false }))],
      rank('rtf:order'),
    );
    const task: MockTrueFalseTask = { id, kind: 'true_false', instruction: instr('true_false'), text: text.map((s) => s.target).join(' '), statements };
    return task;
  });

  // --- Olvasás 4: lyukas mondatok.
  add('reading', (id, instr) => (gaps.length >= 2 ? { id, kind: 'gap_mc', instruction: instr('gap_mc'), gaps } : null));

  // --- Hallás 1: rövid mondatok, soronként egy kérdés ("mit hallottál").
  const listenTask = (id: string, kind: 'listen_mc' | 'listen_dialogue', instruction: string, n: number, part: string): MockListenTask | null => {
    const picked = take(n);
    if (picked.length < 2) return null;
    const questions = picked.map((s, i) => {
      const wrong = decoys([s], 2, `${part}:${i}`).map((d) => d.source);
      return choice(s.source, wrong, `${part}o:${i}:${s.itemId}`);
    });
    return { id, kind, instruction, audio: picked.map((s) => s.target), questions };
  };
  add('listening', (id, instr) => listenTask(id, 'listen_mc', instr('listen_mc'), c.listenMc, 'lm'));
  add('listening', (id, instr) => matchTask(id, 'listen_match', instr('listen_match'), c.listenMatch, 'lx'));
  add('listening', (id, instr) => listenTask(id, 'listen_dialogue', instr('listen_dialogue'), c.listenDialogue, 'ld'));

  // --- Írás: a szerzői feladatok (utasítással, tartalmi pontokkal), id-vel.
  const writing: MockTask[] = (MOCK_WRITING[`${target}:${level}`] ?? []).map((t, i) => ({ ...t, id: `writing-${i + 1}` }) as MockTask);

  const papers: MockPaper[] = bp.sections.map((sec) => ({
    skill: sec.skill,
    name: sec.name,
    minutes: sec.minutes,
    points: sec.points,
    placeholder: sec.skill === 'speaking',
    tasks: sec.skill === 'reading' ? tasks.reading : sec.skill === 'listening' ? tasks.listening : sec.skill === 'writing' ? writing : [],
  }));

  return { target, level, seed, papers, groups: bp.groups };
}

/** A feladatsor tartalmi ujjlenyomata: a mentett vizsga csak akkor folytatható, ha ugyanezt a sort kapjuk vissza. */
export function mockExamSignature(exam: MockExam): string {
  return String(hashString(JSON.stringify(exam.papers.map((p) => p.tasks))));
}
