// Data fixes of the Learn (PCIC) cards after user feedback.
// Every item is a test of its own, so the fix cannot slip back.
import { gradePcicAnswer } from '@/lib/pcicMatch';
import { dropOrphanCards } from '@/lib/pcicSession';
import type { Sm2Card } from '@/lib/sm2';
import retired from '../../scripts/words-open-retired.json';
import { findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget } from '../pcic';

describe('data/words-open card fixes', () => {
  beforeEach(() => setPcicTarget('es'));
  afterEach(() => setPcicTarget('es'));

  it('adelante (o896) sentence is an unambiguous direction sentence, not the "va adelante" car one that can be misread', () => {
    const item = findPcicItem('o896');
    expect(item?.exampleEs).toBe('La tienda está adelante, no muy lejos.');
    expect(item?.exampleEn).toBe('The store is up ahead, not very far.');
  });

  it('the ser card (o11) sentence works only with ser, no ser/estar-ambiguous adjective in it', () => {
    const ex = findPcicItem('o11')?.exampleEs ?? '';
    expect(ex).not.toBe('');
    expect(ex).not.toMatch(/\b(feliz|contento|triste|aburrid[oa]|list[oa]|buen[oa]|mal[oa]|cansad[oa]|nervios[oa])\b/i);
    expect(ex).toMatch(/\b(soy|eres|es|somos|son)\b/i);
    expect(ex).not.toMatch(/\b(estoy|estás|está|estamos|están)\b/i);
  });

  it('the ropero card (o675) sentence uses the first right answer (ropero), not armario', () => {
    const item = findPcicItem('o675');
    expect(item?.es).toBe('el ropero / el armario');
    expect(item?.exampleEs).toMatch(/\bropero\b/);
    expect(item?.exampleEs).not.toMatch(/\barmario\b/);
  });

  it('every question word is at A1 (cómo, dónde, qué, quién, cuál, cuándo, cuánto, adónde)', () => {
    const orders = { cómo: 90, dónde: 91, qué: 92, quién: 93, cuál: 160, cuándo: 161, cuánto: 162, adónde: 737 };
    for (const [word, order] of Object.entries(orders)) {
      expect({ word, level: levelOfItem(`o${order}`) }).toEqual({ word, level: 'A1' });
      expect(findPcicItem(`o${order}`)?.es).toBe(word);
    }
  });

  it('the todavía (o178) sentence under the question and the revealed example sentence carry the same meaning (still)', () => {
    const item = findPcicItem('o178');
    expect(item?.hint).toMatch(/\*still\*/i);
    expect(item?.exampleEn).toMatch(/\bstill\b/i);
    expect(item?.exampleEn).not.toMatch(/\byet\b/i);
  });

  it('no separate jitomate card, on the tomate (o940) card jitomate is also an accepted answer', () => {
    const item = findPcicItem('o940');
    expect(item?.es).toBe('el tomate / el jitomate');
    expect(item?.en).toBe('tomato');
    expect(gradePcicAnswer('el jitomate', item!.es)).toMatchObject({ match: 'exact', best: 'el jitomate' });
    expect(gradePcicAnswer('el tomate', item!.es)).toMatchObject({ match: 'exact', best: 'el tomate' });
    const all = (['A1', 'A2', 'B1', 'B2'] as const).flatMap((l) => pcicItemsForLevel(l));
    expect(all.filter((i) => i.es.split(' / ')[0].replace(/^el /, '') === 'jitomate')).toEqual([]);
  });

  it('taquería (o2705) was removed from Learn, its order cannot be reused, the other orders did not shift, the app skips the orphan SRS row', () => {
    expect(findPcicItem('o2705')).toBeUndefined();
    expect(retired.retired.map((r) => r.order)).toContain(2705);
    const all = (['A1', 'A2', 'B1', 'B2'] as const).flatMap((l) => pcicItemsForLevel(l));
    const orders = new Set(all.map((i) => i.order));
    for (const r of retired.retired) expect(orders.has(r.order)).toBe(false);
    // the neighbouring orders stayed the same cards
    expect(findPcicItem('o2704')?.order).toBe(2704);
    expect(findPcicItem('o2706')?.order).toBe(2706);
    // the progress row of the vanished card is orphaned: the session skips it
    const orphan = { itemId: 'o2705', state: 'review' } as Sm2Card;
    expect(dropOrphanCards([orphan], (id) => findPcicItem(id) !== undefined)).toEqual([]);
  });

  it('on the lo / le / se cards (o84-86) a short English sentence stands under the question, as on the te (o83) card', () => {
    expect(findPcicItem('o83')?.hint).toBeTruthy();
    for (const id of ['o84', 'o85', 'o86']) {
      expect(findPcicItem(id)?.hint).toMatch(/^[^*]*\*[^*]+\*[^*]*$/);
    }
  });
});
