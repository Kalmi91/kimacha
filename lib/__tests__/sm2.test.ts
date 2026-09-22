// PLAN-pcic 4. lépés: SM-2 (Anki-módszerű) ütemező tiszta függvényei.

import { sm2NewCard, sm2Review, sm2PreviewDays, pickSm2Session, sm2MarkKnown, addDays, KNOWN_INTERVAL_DAYS, DEFAULT_NEW_LIMIT, type Sm2Card } from '../sm2';

const TODAY = '2026-09-18';
const TOMORROW = addDays(TODAY, 1);

function reviewCard(overrides: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId: 'b1-0001',
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 10,
    reps: 3,
    lapses: 0,
    due: TODAY,
    lastReview: addDays(TODAY, -10),
    introducedAt: addDays(TODAY, -30),
    ...overrides,
  };
}

describe('sm2Review, learning/new', () => {
  it('new + good x2 graduates to review, interval 1, due tomorrow', () => {
    const c0 = sm2NewCard('b1-0001');
    const c1 = sm2Review(c0, 'good', TODAY);
    expect(c1.state).toBe('learning');
    expect(c1.step).toBe(1);
    expect(c1.due).toBe(TODAY);
    expect(c1.introducedAt).toBe(TODAY);

    const c2 = sm2Review(c1, 'good', TODAY);
    expect(c2.state).toBe('review');
    expect(c2.interval).toBe(1);
    expect(c2.due).toBe(TOMORROW);
  });

  it('new + easy graduates immediately, interval 4', () => {
    const c0 = sm2NewCard('b1-0002');
    const c1 = sm2Review(c0, 'easy', TODAY);
    expect(c1.state).toBe('review');
    expect(c1.interval).toBe(4);
    expect(c1.due).toBe(addDays(TODAY, 4));
    expect(c1.introducedAt).toBe(TODAY);
  });

  it('new + again stays in learning step 0, due today', () => {
    const c0 = sm2NewCard('b1-0003');
    const c1 = sm2Review(c0, 'again', TODAY);
    expect(c1.state).toBe('learning');
    expect(c1.step).toBe(0);
    expect(c1.due).toBe(TODAY);
    expect(c1.introducedAt).toBe(TODAY);
  });

  it('new + hard stays in learning step 0, due today', () => {
    const c0 = sm2NewCard('b1-0004');
    const c1 = sm2Review(c0, 'hard', TODAY);
    expect(c1.state).toBe('learning');
    expect(c1.step).toBe(0);
    expect(c1.due).toBe(TODAY);
  });
});

describe('sm2Review, review állapot', () => {
  it('good: interval = round(interval * ease)', () => {
    const next = sm2Review(reviewCard({ interval: 10, ease: 2.5 }), 'good', TODAY);
    expect(next.interval).toBe(25);
    expect(next.ease).toBe(2.5);
    expect(next.due).toBe(addDays(TODAY, 25));
  });

  it('hard: interval = round(interval * 1.2), ease - 0.15', () => {
    const next = sm2Review(reviewCard({ interval: 10, ease: 2.5 }), 'hard', TODAY);
    expect(next.interval).toBe(12);
    expect(next.ease).toBeCloseTo(2.35);
  });

  it('easy: interval = round(interval * ease * 1.3), ease + 0.15', () => {
    const next = sm2Review(reviewCard({ interval: 10, ease: 2.5 }), 'easy', TODAY);
    // round(10 * 2.5 * 1.3) = round(32.5) = 33 a kódban (Math.round felkerekít .5-nél)
    expect(next.interval).toBe(33);
    expect(next.ease).toBeCloseTo(2.65);
  });

  it('again: lapse, ease - 0.20, learning step 0, majd good x2 -> interval 1', () => {
    const lapsed = sm2Review(reviewCard({ ease: 2.5, lapses: 0 }), 'again', TODAY);
    expect(lapsed.state).toBe('learning');
    expect(lapsed.step).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeCloseTo(2.3);
    expect(lapsed.due).toBe(TODAY);

    const g1 = sm2Review(lapsed, 'good', TODAY);
    expect(g1.state).toBe('learning');
    expect(g1.step).toBe(1);

    const g2 = sm2Review(g1, 'good', TODAY);
    expect(g2.state).toBe('review');
    expect(g2.interval).toBe(1);
    expect(g2.due).toBe(TOMORROW);
  });

  it('ease floor 1.3, ismételt again sem megy alá', () => {
    let card = reviewCard({ ease: 1.4 });
    card = sm2Review(card, 'again', TODAY);
    expect(card.ease).toBeCloseTo(1.3);
    // relearning -> graduál vissza review-ba, ismét again
    card = sm2Review(card, 'good', TODAY);
    card = sm2Review(card, 'good', TODAY);
    expect(card.state).toBe('review');
    card = sm2Review(card, 'again', TODAY);
    expect(card.ease).toBeCloseTo(1.3);
  });

  it('interval floor: min interval + 1 alacsony ease-nél is', () => {
    const next = sm2Review(reviewCard({ interval: 5, ease: 1.3 }), 'good', TODAY);
    // round(5 * 1.3) = round(6.5) = 7 (Math.round felkerekít .5-nél), ami már > interval+1
    expect(next.interval).toBeGreaterThanOrEqual(6);
  });

  it('reps mindig +1, lastReview = today', () => {
    const next = sm2Review(reviewCard({ reps: 7 }), 'good', TODAY);
    expect(next.reps).toBe(8);
    expect(next.lastReview).toBe(TODAY);
  });
});

describe('sm2PreviewDays', () => {
  it('learning kártyánál 0 nap a nem-graduáló gombokra', () => {
    const c0 = sm2NewCard('b1-0005');
    const days = sm2PreviewDays(c0, TODAY);
    expect(days.again).toBe(0);
    expect(days.hard).toBe(0);
    expect(days.easy).toBe(4);
  });

  it('review kártyánál napok számában adja vissza', () => {
    const days = sm2PreviewDays(reviewCard({ interval: 10, ease: 2.5 }), TODAY);
    expect(days.good).toBe(25);
    expect(days.hard).toBe(12);
    expect(days.again).toBe(0);
  });
});

describe('pickSm2Session', () => {
  it('esedékes review az új kártyák előtt, learning benne van', () => {
    const dueReview = reviewCard({ itemId: 'r1', due: TODAY });
    const laterReview = reviewCard({ itemId: 'r2', due: addDays(TODAY, 5) });
    const learningCard: Sm2Card = { ...sm2NewCard('l1'), state: 'learning', step: 0, due: TODAY, introducedAt: TODAY };

    const session = pickSm2Session([dueReview, laterReview, learningCard], ['n1', 'n2'], TODAY, 20);
    const ids = session.map(c => c.itemId);
    expect(ids[0]).toBe('r1');
    expect(ids).toContain('l1');
    expect(ids).toContain('n1');
    expect(ids).toContain('n2');
    expect(ids).not.toContain('r2'); // csak jövőben esedékes, nincs benne
  });

  it('newLimit tartva a mai introducedAt beszámításával', () => {
    const alreadyIntroduced: Sm2Card[] = ['a', 'b', 'c'].map(id => ({
      ...sm2NewCard(id),
      state: 'learning',
      due: TODAY,
      introducedAt: TODAY,
    }));
    const newOrder = ['n1', 'n2', 'n3', 'n4', 'n5'];
    const session = pickSm2Session(alreadyIntroduced, newOrder, TODAY, 5);
    const newOnes = session.filter(c => c.state === 'new');
    expect(newOnes.length).toBe(2); // 5 - 3 már bevezetett
  });

  it('due <= today szerint rendezi a review kártyákat növekvő sorrendbe', () => {
    const later = reviewCard({ itemId: 'r-later', due: TODAY });
    const earlier = reviewCard({ itemId: 'r-earlier', due: addDays(TODAY, -3) });
    const session = pickSm2Session([later, earlier], [], TODAY, 20);
    expect(session.map(c => c.itemId)).toEqual(['r-earlier', 'r-later']);
  });
});

// FB314: a "+10 új szó" gomb a newLimit paramétert emeli meg futásidőben.
describe('pickSm2Session, newLimit határeset (FB314)', () => {
  it('25 új tétel, 20 ma bevezetett: alap keret 0 új, newLimit 30 az 5 maradékot adja, a 20 learning a sor elején marad', () => {
    const newOrder = Array.from({ length: 25 }, (_, i) => `n${i}`);
    // az első 20 newOrder-tétel ma már bevezetve (learning), az utolsó 5 (n20..n24) még valódi új
    const introduced: Sm2Card[] = newOrder.slice(0, 20).map((id) => ({
      ...sm2NewCard(id),
      state: 'learning',
      due: TODAY,
      introducedAt: TODAY,
    }));

    const atDefault = pickSm2Session(introduced, newOrder, TODAY, DEFAULT_NEW_LIMIT);
    expect(atDefault.filter(c => c.state === 'new').length).toBe(0);

    const atThirty = pickSm2Session(introduced, newOrder, TODAY, 30);
    expect(atThirty.filter(c => c.state === 'new').length).toBe(5);
    expect(atThirty.slice(0, 20).every(c => c.state === 'learning')).toBe(true);
  });

  it('ha minden újként megjelölt tétel már be van vezetve, nagy newLimit sem ad új lapot', () => {
    const newOrder = Array.from({ length: 25 }, (_, i) => `n${i}`);
    const allIntroduced: Sm2Card[] = newOrder.map((id) => ({
      ...sm2NewCard(id),
      state: 'learning',
      due: TODAY,
      introducedAt: addDays(TODAY, -1),
    }));
    const session = pickSm2Session(allIntroduced, newOrder, TODAY, 30);
    expect(session.filter(c => c.state === 'new').length).toBe(0);
  });
});

describe('sm2MarkKnown', () => {
  it('new kártyát review-ra állítja, interval KNOWN_INTERVAL_DAYS, ease változatlan, known true', () => {
    const c0 = sm2NewCard('b1-0001');
    const known = sm2MarkKnown(c0, TODAY);
    expect(known.state).toBe('review');
    expect(known.step).toBe(0);
    expect(known.interval).toBe(KNOWN_INTERVAL_DAYS);
    expect(known.due).toBe(addDays(TODAY, KNOWN_INTERVAL_DAYS));
    expect(known.ease).toBe(2.5);
    expect(known.known).toBe(true);
    expect(known.introducedAt).toBe(TODAY);
  });

  it('review kártyánál az ease marad', () => {
    const c0 = reviewCard({ ease: 2.1 });
    const known = sm2MarkKnown(c0, TODAY);
    expect(known.ease).toBe(2.1);
    expect(known.state).toBe('review');
    expect(known.interval).toBe(KNOWN_INTERVAL_DAYS);
    expect(known.known).toBe(true);
  });
});

describe('addDays', () => {
  it('napokat ad hozzá, hónap-/évváltásnál is', () => {
    expect(addDays('2026-09-18', 1)).toBe('2026-09-19');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-09-18', -3)).toBe('2026-09-15');
  });
});
