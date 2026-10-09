// FB443/FB445: a lecke body-ban egymás után álló, egyetlen igés ragozási
// táblákból (pl. indefinido-10-verbos: tíz tábla) egy füles csoport lesz, hogy
// ne tíz táblányi helyet foglaljanak. Tiszta függvény, hogy tesztelhető legyen.
import type { LessonBlock } from './lessonTypes';
import { isConjugationTable } from './tableShape';

export type TableBlock = Extract<LessonBlock, { kind: 'table' }>;

type BodyEntry =
  | { kind: 'block'; block: LessonBlock; index: number }
  | { kind: 'tabs'; tables: TableBlock[]; index: number };

/** Ennyi, egymás utáni egy-igés ragozási táblától lesz füles csoport. */
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
