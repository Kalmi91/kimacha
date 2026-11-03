import { DE_DRILL_LEVELS, buildTenseRound, drillTenseLevel, drillVerbs, gradeTense, tensesAtLevel } from '../deTenseDrill';
import { atLeast } from '@/lib/deForms';

const q = (answer: string, accept: string[] = []) => ({ answer, accept });

describe('the German tense drill: what a level asks', () => {
  it('Präsens from A1, Perfekt from A1 (common verbs) or A2, Präteritum from A2, Futur I and Konjunktiv II from B1', () => {
    expect(tensesAtLevel('A1')).toEqual(['praesens', 'perfekt']);
    expect(tensesAtLevel('A2')).toEqual(['praesens', 'perfekt', 'praeteritum']);
    expect(tensesAtLevel('B1')).toEqual(['praesens', 'perfekt', 'praeteritum', 'futur1', 'konjunktiv2']);
    expect(drillTenseLevel('gehen', 'perfekt')).toBe('A1');
    expect(drillTenseLevel('erwähnen', 'perfekt')).toBe('A2');
    expect(drillTenseLevel('sein', 'praeteritum')).toBe('A2');
    expect(drillTenseLevel('können', 'praeteritum')).toBe('A2');
    expect(drillTenseLevel('arbeiten', 'praeteritum')).toBe('B1');
    expect(drillTenseLevel('gehen', 'konjunktiv2')).toBe('B1');
    expect(drillTenseLevel('gehen', 'konjunktiv2', true)).toBe('C1');
  });

  it('a round never asks a tense above its level, nor a verb above it', () => {
    for (const level of DE_DRILL_LEVELS) {
      for (let seed = 1; seed <= 6; seed++) {
        const round = buildTenseRound({ level, seed });
        expect(round.length).toBe(10);
        for (const question of round) {
          expect(atLeast(level, question.level)).toBe(true);
          expect(tensesAtLevel(level)).toContain(question.tense);
          expect(atLeast(level, drillTenseLevel(question.infinitive, question.tense, question.own))).toBe(true);
        }
      }
    }
  });

  it('asks a verb once per round, the same round for the same seed, another for another seed', () => {
    const a = buildTenseRound({ level: 'B1', seed: 7 });
    expect(new Set(a.map((x) => x.infinitive)).size).toBe(a.length);
    expect(buildTenseRound({ level: 'B1', seed: 7 })).toEqual(a);
    expect(buildTenseRound({ level: 'B1', seed: 8 }).map((x) => x.id)).not.toEqual(a.map((x) => x.id));
  });

  it('one tense only, when the learner picks one; the own Konjunktiv II only at C1', () => {
    for (const tense of ['praesens', 'perfekt', 'praeteritum', 'futur1', 'konjunktiv2'] as const) {
      const level = tense === 'futur1' || tense === 'konjunktiv2' ? 'B1' : tense === 'praeteritum' ? 'A2' : 'A1';
      expect(buildTenseRound({ level, tense, seed: 3 }).every((x) => x.tense === tense)).toBe(true);
    }
    expect(buildTenseRound({ level: 'B2', tense: 'konjunktiv2', size: 30, seed: 5 }).some((x) => x.own)).toBe(false);
    expect(buildTenseRound({ level: 'C1', tense: 'konjunktiv2', size: 60, seed: 5 }).some((x) => x.own)).toBe(true);
  });

  it('carries the person label, the answer with its pronoun and the meaning in the three learner languages', () => {
    const verb = drillVerbs().find((v) => v.infinitive === 'aufstehen')!;
    expect(verb.level).toBe('A2');
    expect(verb.meaning.en).toBe('to get up');
    const [first] = buildTenseRound({ level: 'A1', tense: 'praesens', seed: 1 });
    expect(first.answer.startsWith(first.person === 'er' ? 'er ' : `${first.person} `)).toBe(true);
    expect(first.personLabel).toBe({ ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie/Sie' }[first.person]);
    expect(first.meaning.es).toBeTruthy();
  });
});

describe('grading', () => {
  it('the pronoun is optional, case does not matter, the other pronoun of er / sie is fine', () => {
    const er = q('er ist aufgestanden', ['ist aufgestanden', 'sie ist aufgestanden', 'es ist aufgestanden']);
    expect(gradeTense('er ist aufgestanden', er)).toBe(true);
    expect(gradeTense('Ist aufgestanden', er)).toBe(true);
    expect(gradeTense('sie ist aufgestanden.', er)).toBe(true);
    expect(gradeTense('er hat aufgestanden', er)).toBe(false);
    expect(gradeTense('', er)).toBe(false);
  });

  it('the umlaut and the ß are graded: fährt is not fahrt, weiß is not weis', () => {
    expect(gradeTense('er fährt', q('er fährt'))).toBe(true);
    expect(gradeTense('er fahrt', q('er fährt'))).toBe(false);
    expect(gradeTense('ich wuste', q('ich wusste'))).toBe(false);
    expect(gradeTense('ich weiß', q('ich weiß'))).toBe(true);
    expect(gradeTense('ich weis', q('ich weiß'))).toBe(false);
    expect(gradeTense('du kamst', q('du kämst'))).toBe(false);
  });

  it('the typewriter spelling (ae, oe, ue, ss) passes while accents are forgiven, and fails with strict accents', () => {
    expect(gradeTense('er faehrt', q('er fährt'))).toBe(true);
    expect(gradeTense('ich weiss', q('ich weiß'))).toBe(true);
    expect(gradeTense('er faehrt', q('er fährt'), { strictAccents: true })).toBe(false);
    expect(gradeTense('ich weiss', q('ich weiß'), { strictAccents: true })).toBe(false);
  });
});
