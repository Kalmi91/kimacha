// Single-verb conjugation tables that follow each other in a lesson body
// (e.g. indefinido-10-verbos: ten tables) become one tabbed group, so they
// do not take up the space of ten tables. A pure function so it is testable.
import type { LessonBlock } from './lessonTypes';
import { isConjugationTable } from './tableShape';

export type TableBlock = Extract<LessonBlock, { kind: 'table' }>;

type BodyEntry =
  | { kind: 'block'; block: LessonBlock; index: number }
  | { kind: 'tabs'; tables: TableBlock[]; index: number };

/** From this many consecutive single-verb conjugation tables on, they become a tabbed group. */
const TABLE_TABS_MIN = 3;

function isSingleVerbConjugation(block: LessonBlock): block is TableBlock {
  return block.kind === 'table' && block.header.length === 2 && isConjugationTable(block.header, block.rows);
}

export function groupTableRuns(blocks: LessonBlock[]): BodyEntry[] {
  const out: BodyEntry[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (isSingleVerbConjugation(block)) {
      let j = i;
      const run: TableBlock[] = [];
      while (j < blocks.length) {
        const b = blocks[j];
        if (!isSingleVerbConjugation(b)) break;
        run.push(b);
        j++;
      }
      if (run.length >= TABLE_TABS_MIN) {
        out.push({ kind: 'tabs', tables: run, index: i });
      } else {
        run.forEach((b, k) => out.push({ kind: 'block', block: b, index: i + k }));
      }
      i = j;
      continue;
    }
    out.push({ kind: 'block', block, index: i });
    i++;
  }
  return out;
}
