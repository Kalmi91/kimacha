// Opposites round logic (lib/practice/opposites.ts): the pair lookup, the four options (no second opposite of the word among them),
// the taps, the saved-state check. The real corpus and the real pair data are used.

import { findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import {
  OPPOSITES_OPTIONS,
  buildQuestion,
  isOppositesUsable,
  nextOpposites,
  oppositeText,
  oppositesDone,
  oppositesOf,
  oppositesPosition,
  oppositesScore,
  parseOpposites,
  pickOption,
  startOpposites,
  type OppositesState,
} from '../opposites';

setPcicTarget('es');
const ALL: PcicItem[] = [...pcicItemsForLevel('A1'), ...pcicItemsForLevel('A2'), ...pcicItemsForLevel('B1')];
const byEs = (es: string): PcicItem => {
  const found = ALL.find((i) => i.es === es && oppositesOf(i.id).length > 0);
  if (!found) throw new Error(`no paired card for ${es}`);
  return found;
};
const everything = new Set(ALL.map((i) => i.id));
let askableAll: PcicItem[] | null = null;
const askable = (n: number): PcicItem[] => (askableAll ??= ALL.filter((i) => buildQuestion(i, everything) !== null)).slice(0, n);
const start = (items: PcicItem[]) =>
  startOpposites(items.map((i) => i.id), { items, learned: everything });
const adjectivesBut = (...skip: PcicItem[]) => ALL.filter((i) => i.pos === 'adj' && !skip.includes(i));

describe('oppositesOf', () => {
  it('viejo is a pair of joven AND of nuevo, and both ways; most words have none', () => {
    const viejo = byEs('viejo');
    expect([...oppositesOf(viejo.id)].sort()).toEqual([byEs('joven').id, byEs('nuevo').id].sort());
    expect(oppositesOf(byEs('joven').id)).toContain(viejo.id);
    const casa = ALL.find((i) => i.es === 'la casa')!;
    expect(oppositesOf(casa.id)).toEqual([]);
  });
});

describe('buildQuestion', () => {
  it('four different learned words of the same part of speech: the opposite and three others, none is the word', () => {
    const viejo = byEs('viejo');
    const q = buildQuestion(viejo, everything)!;
    expect(q.options).toHaveLength(OPPOSITES_OPTIONS);
    expect(new Set(q.options).size).toBe(OPPOSITES_OPTIONS);
    expect(q.options).toContain(q.answer);
    expect(oppositesOf(viejo.id)).toContain(q.answer);
    expect(q.options).not.toContain(viejo.id);
    for (const id of q.options) expect(findPcicItem(id)!.pos).toBe('adj');
    expect(new Set(q.options.map((id) => oppositeText(findPcicItem(id)!).toLowerCase())).size).toBe(OPPOSITES_OPTIONS);
  });

  it('is the same question every time', () => {
    const viejo = byEs('viejo');
    expect(buildQuestion(viejo, everything)).toEqual(buildQuestion(viejo, everything));
  });

  it('viejo: joven and nuevo are never both options (the other pair stays out even when it is learned)', () => {
    const viejo = byEs('viejo');
    const both = oppositesOf(viejo.id);
    const q = buildQuestion(viejo, everything)!;
    expect(q.options.filter((id) => both.includes(id))).toEqual([q.answer]);
    // only one of the two learned: that one is the answer
    const joven = byEs('joven');
    const nuevo = byEs('nuevo');
    const onlyNuevo = new Set(everything);
    onlyNuevo.delete(joven.id);
    expect(buildQuestion(viejo, onlyNuevo)!.answer).toBe(nuevo.id);
    const onlyJoven = new Set(everything);
    onlyJoven.delete(nuevo.id);
    expect(buildQuestion(viejo, onlyJoven)!.answer).toBe(joven.id);
  });

  it('every word with more than one pair keeps them apart: viejo, aburrido, salir, perder, morir, levantarse, dulce', () => {
    for (const es of ['viejo', 'aburrido', 'salir', 'perder', 'morir', 'levantarse', 'dulce']) {
      const item = byEs(es);
      const partners = oppositesOf(item.id);
      expect(partners.length).toBeGreaterThan(1);
      const q = buildQuestion(item, everything)!;
      expect(q).not.toBeNull();
      expect(q.options.filter((id) => partners.includes(id))).toEqual([q.answer]);
    }
  });

  it('holds for every word of the pair data when everything is learned', () => {
    let asked = 0;
    for (const item of ALL) {
      const q = buildQuestion(item, everything);
      if (!q) continue;
      asked++;
      const partners = oppositesOf(item.id);
      expect(q.options.filter((id) => partners.includes(id))).toEqual([q.answer]);
      expect(q.options).not.toContain(item.id);
      expect(new Set(q.options).size).toBe(OPPOSITES_OPTIONS);
      for (const id of q.options) expect(findPcicItem(id)!.pos).toBe(item.pos);
    }
    expect(asked).toBeGreaterThan(150);
  });

  it('no question without a learned opposite, or with fewer than 3 other learned words of its part of speech', () => {
    const viejo = byEs('viejo');
    const joven = byEs('joven');
    const nuevo = byEs('nuevo');
    const others = adjectivesBut(viejo, joven, nuevo).filter((i) => !oppositesOf(viejo.id).includes(i.id));
    expect(buildQuestion(viejo, new Set([viejo.id, ...others.map((i) => i.id)]))).toBeNull();
    expect(buildQuestion(viejo, new Set([viejo.id, joven.id, ...others.slice(0, 2).map((i) => i.id)]))).toBeNull();
    expect(buildQuestion(viejo, new Set([viejo.id, joven.id, ...others.slice(0, 3).map((i) => i.id)]))).not.toBeNull();
  });

  it('a word that is in no pair has no question; usable follows the question', () => {
    const casa = ALL.find((i) => i.es === 'la casa')!;
    expect(buildQuestion(casa, everything)).toBeNull();
    expect(isOppositesUsable(casa, 'es', everything)).toBe(false);
    expect(isOppositesUsable(byEs('viejo'), 'es', everything)).toBe(true);
  });
});

describe('the taps', () => {
  it('starts on the first word with nothing answered', () => {
    const items = askable(3);
    const state = start(items);
    expect(state.queue).toEqual(items.map((i) => i.id));
    expect(Object.keys(state.questions).sort()).toEqual(items.map((i) => i.id).sort());
    expect(state).toMatchObject({ picked: null, right: [], turn: 0 });
    expect(oppositesDone(state)).toBe(false);
  });

  it('the right option is a hit, once; a second tap does nothing', () => {
    const items = askable(3);
    const state = start(items);
    const q = state.questions[items[0].id];
    const first = pickOption(state, q.answer);
    expect(first.hit).toBe(true);
    expect(first.state).toMatchObject({ picked: q.answer, right: [items[0].id] });
    const again = pickOption(first.state, q.options.find((o) => o !== q.answer)!);
    expect(again.hit).toBeNull();
    expect(again.state).toBe(first.state);
  });

  it('a wrong option is a miss: it is the pick, the word is not among the right ones', () => {
    const items = askable(3);
    const state = start(items);
    const q = state.questions[items[0].id];
    const wrong = q.options.find((o) => o !== q.answer)!;
    const result = pickOption(state, wrong);
    expect(result.hit).toBe(false);
    expect(result.state).toMatchObject({ picked: wrong, right: [] });
  });

  it('a card that is not an option of the word does nothing', () => {
    const items = askable(3);
    const state = start(items);
    expect(pickOption(state, 'o99999').hit).toBeNull();
  });

  it('Next only after an answer; the end of the round counts the right ones', () => {
    const items = askable(3);
    let state = start(items);
    expect(nextOpposites(state)).toBe(state);
    expect(oppositesPosition(state, 3)).toBe(1);
    for (const [n, item] of items.entries()) {
      const q = state.questions[item.id];
      state = pickOption(state, n === 1 ? q.options.find((o) => o !== q.answer)! : q.answer).state;
      state = nextOpposites(state);
      expect(state.turn).toBe(n + 1);
    }
    expect(oppositesDone(state)).toBe(true);
    expect(oppositesScore(state)).toBe(2);
    expect(oppositesPosition(state, 3)).toBe(3);
  });
});

describe('parseOpposites', () => {
  const items = askable(3);
  const ids = items.map((i) => i.id);
  const fresh = start(items);
  const roundTrip = (state: OppositesState) => JSON.parse(JSON.stringify(state)) as unknown;
  const mutate = (change: (copy: any) => void) => {
    const copy = roundTrip(fresh);
    change(copy);
    return parseOpposites(copy, ids);
  };

  it('a saved state comes back, fresh, answered right and answered wrong', () => {
    expect(parseOpposites(roundTrip(fresh), ids)).toEqual(fresh);
    const q = fresh.questions[ids[0]];
    const right = pickOption(fresh, q.answer).state;
    expect(parseOpposites(roundTrip(right), ids)).toEqual(right);
    const wrong = pickOption(fresh, q.options.find((o) => o !== q.answer)!).state;
    expect(parseOpposites(roundTrip(wrong), ids)).toEqual(wrong);
  });

  it('broken values are not resumed', () => {
    expect(parseOpposites(null, ids)).toBeNull();
    expect(parseOpposites('x', ids)).toBeNull();
    expect(parseOpposites({}, ids)).toBeNull();
    expect(mutate((c) => { c.queue = ['nope']; })).toBeNull();
    expect(mutate((c) => { c.turn = -1; })).toBeNull();
    expect(mutate((c) => { delete c.questions[ids[0]]; })).toBeNull();
    expect(mutate((c) => { c.questions[ids[0]].options.pop(); })).toBeNull();
    expect(mutate((c) => { c.questions[ids[0]].options[0] = 'o99999'; })).toBeNull();
    expect(mutate((c) => { c.questions[ids[0]].options[1] = c.questions[ids[0]].options[0]; })).toBeNull();
  });

  it('the answer has to be an opposite of the word, and no other opposite of it may be an option', () => {
    const q = fresh.questions[ids[0]];
    const notAnswer = q.options.find((o) => o !== q.answer)!;
    expect(mutate((c) => { c.questions[ids[0]].answer = notAnswer; })).toBeNull();
    const viejo = byEs('viejo');
    const [joven, nuevo] = [byEs('joven'), byEs('nuevo')];
    const others = adjectivesBut(viejo, joven, nuevo).slice(0, 2).map((i) => i.id);
    const withViejo = startOpposites([viejo.id], { items: [viejo], learned: everything });
    const saved = roundTrip(withViejo) as any;
    saved.questions[viejo.id] = { options: [joven.id, nuevo.id, ...others], answer: joven.id };
    expect(parseOpposites(saved, [viejo.id])).toBeNull();
    saved.questions[viejo.id] = { options: [joven.id, ...others, adjectivesBut(viejo, joven, nuevo)[5].id], answer: joven.id };
    expect(parseOpposites(saved, [viejo.id])).not.toBeNull();
  });

  it('the pick has to be an option of the word on screen and agree with the right list', () => {
    const q = fresh.questions[ids[0]];
    const notAnswer = q.options.find((o) => o !== q.answer)!;
    expect(mutate((c) => { c.picked = 'o99999'; })).toBeNull();
    expect(mutate((c) => { c.picked = q.answer; })).toBeNull();
    expect(mutate((c) => { c.picked = notAnswer; c.right = [ids[0]]; })).toBeNull();
    expect(mutate((c) => { c.right = [ids[0]]; })).toBeNull();
    expect(mutate((c) => { c.picked = q.answer; c.right = [ids[0]]; })).not.toBeNull();
    expect(mutate((c) => { c.queue = []; c.picked = q.answer; })).toBeNull();
  });
});
