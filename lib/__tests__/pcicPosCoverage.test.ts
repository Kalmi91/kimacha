// PLAN-fb0923 2. lepes (FB361-362), or-teszt: A1-B2 minden word/phrase
// tetelnek van szofaja, es sentence/pattern tetelnek sose.
// PLAN-regi-szavak-ki 5. lepes: a posOf lemma-indexe a data/words-open, ezert a
// teszt az elo pakli (data/pcic.ts, en->es irany) tetelein fut a korabbi nyers
// PCIC-json helyett. FB482: a words-open det/interj szofaja (20 det + 6 interj, pl.
// "este", "hola", "adiós") is chipet kap, nincs kivetel.
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
const DET_INTERJ_IDS = new Set(OPEN_CARDS.filter((c) => c.pos === 'det' || c.pos === 'interj').map((c) => `o${c.order}`));

describe('posOf lefedettseg (FB361-362)', () => {
  beforeAll(() => setPcicTarget('es'));

  it('FB482: a det/interj kartyak (26 szo, pl. o883 adiós) is kapnak szofaj-chipet', () => {
    expect(DET_INTERJ_IDS.size).toBe(26);
    const items = (['A1', 'A2', 'B1', 'B2'] as const).flatMap((l) => pcicItemsForLevel(l)).filter((i) => DET_INTERJ_IDS.has(i.id));
    expect(items).toHaveLength(26);
    expect(items.filter((i) => posOf({ es: i.es, kind: i.kind, pos: i.pos }) === null).map((i) => i.id)).toEqual([]);
    expect(posOf({ es: 'adiós', kind: 'word', pos: items.find((i) => i.id === 'o883')?.pos })?.pos).toBe('interj');
  });

  for (const level of PCIC_LEVELS) {
    it(`${level}: minden word/phrase tetel kap szofajt`, () => {
      const wordish = pcicItemsForLevel(level).filter((i) => i.kind === 'word' || i.kind === 'phrase');
      // `pos` nelkul, hogy a lemma-index es a szabaly fedese mulljon, ne a kartya sajat mezoje.
      const missing = wordish
        .filter((i) => posOf({ es: i.es, kind: i.kind }) === null)
        .map((i) => i.id);
      expect(missing).toEqual([]);
    });
  }

  it('sentence tetelre sose jar chip', () => {
    const withChip = OPEN_CARDS.filter(
      (c) => c.sentence_es && posOf({ es: c.sentence_es, kind: 'sentence' }) !== null,
    ).map((c) => c.order);
    expect(withChip).toEqual([]);
  });
});
