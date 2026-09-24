// PLAN-fb0923 2. lepes (FB361-362), or-teszt: A1-B2 minden word/phrase
// tetelnek van szofaja, es sentence/pattern tetelnek sose. A data/pcic/
// <szint>-all.json nyers tetelein fut, nem a szurt PcicItem-listan, hogy a
// (kifele nem publikalt) pattern-kind tetelekre is lefedjen.
import { posOf, type Pos } from '../pcicPos';
import type { PcicKind } from '../../data/pcic';
import a1 from '../../data/pcic/a1-all.json';
import a2 from '../../data/pcic/a2-all.json';
import b1 from '../../data/pcic/b1-all.json';
import b2 from '../../data/pcic/b2-all.json';

interface RawItem {
  id: string;
  es: string;
  kind: PcicKind;
  pos?: Pos;
}

const LEVELS: Record<string, RawItem[]> = {
  A1: a1 as RawItem[],
  A2: a2 as RawItem[],
  B1: b1 as RawItem[],
  B2: b2 as RawItem[],
};

describe('posOf lefedettseg (FB361-362)', () => {
  for (const [level, items] of Object.entries(LEVELS)) {
    const wordish = items.filter((i) => i.kind === 'word' || i.kind === 'phrase');
    const sentenceish = items.filter((i) => i.kind === 'sentence' || i.kind === 'pattern');

    it(`${level}: minden word/phrase tetel kap szofajt`, () => {
      const missing = wordish.filter((i) => posOf(i) === null).map((i) => i.id);
      expect(missing).toEqual([]);
    });

    it(`${level}: sentence/pattern tetelre sose jar chip`, () => {
      const withChip = sentenceish.filter((i) => posOf(i) !== null).map((i) => i.id);
      expect(withChip).toEqual([]);
    });
  }
});
