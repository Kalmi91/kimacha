// PLAN-fb0924 8. lépés (FB394/396): mondat-arány max 1/10 kártya + "A1+"/"A2+"
// virtuális szint. A valódi data/pcic korpuszon fut (nem mock), mert a
// lánc-szerkezet (data/pcic/a1-build.json) és a fájl-sorrend maguk is a
// viselkedés részei (lib/__tests__/pcicChains.test.ts mintája).
import { applyChainOrder, chainGroupId } from '../pcicChains';
import { thinSentences } from '../pcicSession';
import { pcicItemsForViewLevel, findPcicItem } from '../../data/pcic';
import { cardsForViewLevel } from '../pcicLevels';
import { sm2NewCard, sm2Review, type Sm2Card } from '../sm2';
import a1Build from '../../data/pcic/a1-build.json';

const TODAY = '2026-09-24';
const MIN_GAP = 9;

function learnedCard(itemId: string): Sm2Card {
  return sm2Review(sm2Review(sm2NewCard(itemId), 'good', TODAY), 'good', TODAY);
}

/** Végigmegy egy sorrenden, és minden mondat-csoport-váltásnál ellenőrzi, hogy
 *  legalább MIN_GAP nem-mondat kártya volt előtte (a csoport első tagjától). */
function assertSentenceGapRespected(orderedIds: string[], groupOf: (id: string) => string) {
  let sinceGroup = Infinity;
  let lastGroup: string | null = null;
  let groupSwitches = 0;
  for (const id of orderedIds) {
    const item = findPcicItem(id)!;
    if (item.kind !== 'sentence') {
      sinceGroup++;
      continue;
    }
    const group = groupOf(id);
    if (group !== lastGroup) {
      if (lastGroup !== null) {
        expect(sinceGroup).toBeGreaterThanOrEqual(MIN_GAP);
        groupSwitches++;
      }
      lastGroup = group;
      sinceGroup = 0;
    }
  }
  return groupSwitches;
}

describe('PLAN-fb0924 8. lépés: mondat-arány max 1/10 kártya + "A1+"/"A2+" (FB394/396)', () => {
  it('A1 új-sorában nincs nem-lánc mondat, és két lánc-csoport közt legalább 9 kártya', () => {
    // Minden lánc-tag "review", hogy applyChainOrder AZ ÖSSZES lánc-mondatot
    // előrehozza - ez a legszigorúbb próba a ritkításra.
    const allTagIds = new Set<string>();
    for (const entry of Object.values(a1Build as Record<string, { tags: string[]; bridges?: string[] }>)) {
      for (const tagId of entry.tags) allTagIds.add(tagId);
    }
    const cards = [...allTagIds].map(learnedCard);

    const memberIds = pcicItemsForViewLevel('A1').map((i) => i.id);
    const reordered = applyChainOrder(memberIds, cards, 'A1');
    const thinned = thinSentences(reordered, (id) => findPcicItem(id)?.kind, (id) => chainGroupId(id) ?? id);

    // Nincs a lánchoz nem tartozó (a "+1"-be került) mondat.
    for (const id of thinned) {
      const item = findPcicItem(id)!;
      if (item.kind === 'sentence') expect(chainGroupId(id)).toBeDefined();
    }

    const groupSwitches = assertSentenceGapRespected(thinned, (id) => chainGroupId(id) ?? id);
    // Legalább egy csoport-váltás történjen, különben a próba üresen menne át.
    expect(groupSwitches).toBeGreaterThan(0);
  });

  it('"A1+" csak A1-es, lánchoz nem tartozó mondatot ad', () => {
    const items = pcicItemsForViewLevel('A1+');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.kind).toBe('sentence');
      expect(chainGroupId(item.id)).toBeUndefined();
    }
  });

  it('"A2+" csak A2-es mondatot ad (A2-n nincs lánc)', () => {
    const items = pcicItemsForViewLevel('A2+');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.kind).toBe('sentence');
    // A2 valódi (nem "+1") nézetében emiatt egyáltalán nincs mondat.
    expect(pcicItemsForViewLevel('A2').some((i) => i.kind === 'sentence')).toBe(false);
  });

  it('egy már tanult A1 mondat haladással jelenik meg az "A1+"-ben', () => {
    // Nem-lánc A1 mondat ("Esta cámara es nueva."), lásd data/pcic/a1-all.json.
    const sentenceId = 'a1-1aef0ea0';
    expect(chainGroupId(sentenceId)).toBeUndefined();
    const learned = learnedCard(sentenceId);

    const view = cardsForViewLevel([learned], 'A1+');
    expect(view).toHaveLength(1);
    expect(view[0].itemId).toBe(sentenceId);
    expect(view[0].state).not.toBe('new');
    expect(view[0].reps).toBe(learned.reps);
  });

  it('B1-en két mondat közt legalább 9 kártya (nincs lánc, sima ritkítás)', () => {
    const memberIds = pcicItemsForViewLevel('B1').map((i) => i.id);
    const thinned = thinSentences(memberIds, (id) => findPcicItem(id)?.kind, (id) => id);
    const groupSwitches = assertSentenceGapRespected(thinned, (id) => id);
    expect(groupSwitches).toBeGreaterThan(1);
  });
});
