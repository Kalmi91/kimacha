// PLAN-fb0923 8. lépés (FB365-369): applyChainOrder or-tesztjei. A valódi
// data/pcic/a1-build.json + a1-all.json tartalmán fut (nem mock-lánc), mert
// az id-k (és a köztük levő fájl-sorrend, pl. "aeropuerto" a 634. helyen)
// maguk is a viselkedés részei.
import { applyChainOrder } from '../pcicChains';
import { pcicItemsForLevel } from '../../data/pcic';
import { sm2NewCard, sm2Review, type Sm2Card } from '../sm2';
import a1Build from '../../data/pcic/a1-build.json';

const TODAY = '2026-09-24';
const NEW_ORDER = pcicItemsForLevel('A1').map((i) => i.id);

// Sentence1 lánca: "En mi barrio hay dos farmacias."
const S1_SENTENCE = 'a1-eb790784';
const S1_TAGS = ['a1-d1fed5d2', 'a1-2ce33323', 'a1-e67f16d2', 'a1-fb430e74']; // hay, barrio, dos, farmacia
const S1_BRIDGE_A = 'a1-4504328c'; // Mi barrio es grande.
const S1_BRIDGE_B = 'a1-c8a42d40'; // Hay dos farmacias.
const S1_BRIDGE_A_EXTRA_TAG = 'a1-35272bf8'; // grande (bridge A saját tagja)

// Sentence7 lánca (nincs bridge-je): "Sin azúcar, por favor."
const S7_SENTENCE = 'a1-365f9dca';
const S7_TAGS = ['a1-7d14c04a', 'a1-59c21812', 'a1-e392209e']; // sin, azúcar, por favor

/** Kártya adott állapotban ('review'-hoz interval/due nem számít a kapunak). */
function cardIn(itemId: string, state: Sm2Card['state']): Sm2Card {
  const base = sm2NewCard(itemId);
  if (state === 'new') return base;
  if (state === 'review') return sm2Review(sm2Review(base, 'good', TODAY), 'good', TODAY);
  return sm2Review(base, 'hard', TODAY); // learning
}

describe('applyChainOrder (PLAN-fb0923 8. lépés)', () => {
  it('(a) friss A1 profil: az első új kártyák az 1. lánc tagjai, a bridge/mondat még sehol', () => {
    const order = applyChainOrder(NEW_ORDER, [], 'A1');

    expect(order.slice(0, S1_TAGS.length)).toEqual(S1_TAGS);
    // Egyetlen bridge vagy teljes mondat sem jön be, amíg a tagjaik 'new'-ok.
    expect(order).not.toContain(S1_SENTENCE);
    expect(order).not.toContain(S1_BRIDGE_A);
    expect(order).not.toContain(S1_BRIDGE_B);
    expect(order).not.toContain(S7_SENTENCE);
  });

  it('(b) a mondat nem jön, amíg egy tagja nem tudott', () => {
    const cards = [
      cardIn(S7_TAGS[0], 'review'),
      cardIn(S7_TAGS[1], 'review'),
      cardIn(S7_TAGS[2], 'new'), // "por favor" még nem tudott
    ];
    const order = applyChainOrder(NEW_ORDER, cards, 'A1');
    expect(order).not.toContain(S7_SENTENCE);

    // Ha az utolsó tag is tudott lesz, a mondat bekerül.
    const cardsAllKnown = [cardIn(S7_TAGS[0], 'review'), cardIn(S7_TAGS[1], 'review'), cardIn(S7_TAGS[2], 'review')];
    const order2 = applyChainOrder(NEW_ORDER, cardsAllKnown, 'A1');
    expect(order2).toContain(S7_SENTENCE);
  });

  it('(c) menet közbeni felépülés: egy bridge/mondat a cards-frissítés UTÁNI hívásban jelenik meg', () => {
    // 1. pillanat: csak az 1b bridge (hay/dos/farmacia) tagjai tudottak,
    // a barrio/grande (1a bridge + a teljes mondat is ezekre vár) még nem.
    const step1 = S1_TAGS.filter((id) => id !== 'a1-2ce33323').map((id) => cardIn(id, 'review'));
    const order1 = applyChainOrder(NEW_ORDER, step1, 'A1');
    expect(order1).toContain(S1_BRIDGE_B); // hay+dos+farmacia kész -> bridge B jöhet
    expect(order1).not.toContain(S1_BRIDGE_A); // barrio+grande még nem
    expect(order1).not.toContain(S1_SENTENCE); // a teljes mondat is barrio-ra vár

    // 2. pillanat (a "menet közben" értékelt barrio+grande UTÁN): mind a
    // négy tag + a "grande" is tudott -> minden felépül.
    const step2 = [
      ...S1_TAGS.map((id) => cardIn(id, 'review')),
      cardIn(S1_BRIDGE_A_EXTRA_TAG, 'review'),
    ];
    const order2 = applyChainOrder(NEW_ORDER, step2, 'A1');
    expect(order2).toContain(S1_BRIDGE_A);
    expect(order2).toContain(S1_BRIDGE_B);
    expect(order2).toContain(S1_SENTENCE);
  });

  it('(e) a láncon kívüli tételek egymáshoz képesti sorrendje nem változik', () => {
    // build.jsonban a kulcs= 8 mondat/3 bridge, a `chain` halmaz ezek + a
    // rájuk mutató összes tag; minden más tételnek meg kell tartania az
    // eredeti egymáshoz képesti sorrendjét.
    const build = a1Build as Record<string, { tags: string[]; bridges?: string[] }>;
    const chainIds = new Set<string>();
    for (const [id, entry] of Object.entries(build)) {
      chainIds.add(id);
      for (const t of entry.tags) chainIds.add(t);
    }

    const order = applyChainOrder(NEW_ORDER, [], 'A1');
    const expectedRest = NEW_ORDER.filter((id) => !chainIds.has(id));
    const actualRest = order.filter((id) => !chainIds.has(id));
    expect(actualRest).toEqual(expectedRest);
  });
});
