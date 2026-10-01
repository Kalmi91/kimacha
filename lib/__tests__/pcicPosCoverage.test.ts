// PLAN-fb0923 2. lepes (FB361-362), or-teszt: A1-B2 minden word/phrase
// tetelnek van szofaja, es sentence/pattern tetelnek sose.
// PLAN-regi-szavak-ki 5. lepes: a posOf lemma-indexe a data/words-open, ezert a
// teszt az elo pakli (data/pcic.ts, en->es irany) tetelein fut a korabbi nyers
// PCIC-json helyett. Kivetel: a words-open det/interj szofaja (18 det + 4 interj, pl.
// "este", "hola") az app Pos-keszletebe nem kepezheto le, azokra nincs chip.
import { posOf } from '../pcicPos';
import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget } from '../../data/pcic';
import openA1 from '../../data/words-open/a1.json';
import openA2 from '../../data/words-open/a2.json';
import openB1 from '../../data/words-open/b1.json';
import openB2 from '../../data/words-open/b2.json';

interface OpenCard {
  order: number;
  pos: string;
  sentence_es: string;
}

const OPEN_CARDS = [...openA1, ...openA2, ...openB1, ...openB2] as OpenCard[];
const NO_CHIP_IDS = new Set(OPEN_CARDS.filter((c) => c.pos === 'det' || c.pos === 'interj').map((c) => `o${c.order}`));

describe('posOf lefedettseg (FB361-362)', () => {
  beforeAll(() => setPcicTarget('es'));

  it('a det/interj kivetel pontosan 22 szo', () => {
    expect(NO_CHIP_IDS.size).toBe(22);
  });

  for (const level of PCIC_LEVELS) {
    it(`${level}: minden word/phrase tetel kap szofajt`, () => {
      const wordish = pcicItemsForLevel(level).filter((i) => i.kind === 'word' || i.kind === 'phrase');
      // `pos` nelkul, hogy a lemma-index es a szabaly fedese mulljon, ne a kartya sajat mezoje.
      const missing = wordish
        .filter((i) => !NO_CHIP_IDS.has(i.id) && posOf({ es: i.es, kind: i.kind }) === null)
        .map((i) => i.id);
      expect(missing).toEqual([]);
    });
  }

  it('sentence/pattern tetelre sose jar chip', () => {
    const withChip = OPEN_CARDS.filter(
      (c) => c.sentence_es && (posOf({ es: c.sentence_es, kind: 'sentence' }) !== null || posOf({ es: c.sentence_es, kind: 'pattern' }) !== null),
    ).map((c) => c.order);
    expect(withChip).toEqual([]);
  });
});
