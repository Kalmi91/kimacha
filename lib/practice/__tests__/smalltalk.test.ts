import data from '@/data/practice/smalltalk.json';
import { tileWords } from '@/lib/sentenceCards';
import {
  answerBank,
  answerSmallTalk,
  buildItemText,
  buildItems,
  buildTraps,
  judgeAnswer,
  judgeQuestion,
  nextSmallTalk,
  parseSmallTalk,
  questionBank,
  savedSmallTalk,
  smalltalkTopics,
  smalltalkTotals,
  startSmallTalk,
  swapAnswerIndex,
} from '../smalltalk';

const topics = smalltalkTopics('es');
const topic = topics[0];

describe('smalltalk data', () => {
  it('has a Spanish topic and none for German', () => {
    expect(topic.id).toBe('saludos');
    expect(smalltalkTopics('de')).toHaveLength(0);
  });

  it('has no empty strings and 2+ answers per pair', () => {
    const empties: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string') {
        if (!v.trim()) empties.push(path);
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
    };
    walk(data, 'smalltalk');
    expect(empties).toEqual([]);
    for (const t of topics) for (const p of t.pairs) expect(p.answers.length).toBeGreaterThanOrEqual(2);
  });
});

describe('build', () => {
  it('covers every question and every answer exactly once, in data order', () => {
    const items = buildItems(topic);
    const expected = topic.pairs.flatMap((p) => [p.q.es, ...p.answers.map((a) => a.es)]);
    expect(items.map((it) => buildItemText(topic, it).es)).toEqual(expected);
    expect(items).toHaveLength(smalltalkTotals(topic).build);
  });

  it('traps are 2 words that are not in the sentence, stable per seed', () => {
    buildItems(topic).forEach((it, i) => {
      const own = tileWords(buildItemText(topic, it).es).map((w) => w.toLowerCase());
      const traps = buildTraps(topic, i, 5);
      expect(traps).toHaveLength(2);
      traps.forEach((w) => expect(own).not.toContain(w.toLowerCase()));
      expect(buildTraps(topic, i, 5)).toEqual(traps);
    });
  });
});

describe('the app asks', () => {
  it('accepts every answer of every question, typed and as tiles', () => {
    topic.pairs.forEach((p, i) => {
      p.answers.forEach((a) => {
        expect(judgeAnswer(topic, i, a.es).right).toBe(true);
        expect(judgeAnswer(topic, i, tileWords(a.es).join(' ')).right).toBe(true);
      });
    });
  });

  it('reports which answer matched', () => {
    const last = topic.pairs[0].answers.length - 1;
    expect(judgeAnswer(topic, 0, topic.pairs[0].answers[last].es).answer).toBe(last);
  });

  it('rejects a wrong answer', () => {
    expect(judgeAnswer(topic, 0, 'Quiero una cerveza fría').right).toBe(false);
    expect(judgeAnswer(topic, 4, topic.pairs[0].q.es).right).toBe(false);
  });

  it('the word bank has the words of every answer', () => {
    topic.pairs.forEach((p, i) => {
      const bank = answerBank(topic, i, 3).map((w) => w.toLowerCase());
      p.answers.forEach((a) => tileWords(a.es).forEach((w) => expect(bank).toContain(w.toLowerCase())));
      expect(answerBank(topic, i, 3)).toEqual(answerBank(topic, i, 3));
    });
  });
});

describe('you ask', () => {
  it('accepts the question and rejects an answer text', () => {
    topic.pairs.forEach((p, i) => {
      expect(judgeQuestion(topic, i, p.q.es).right).toBe(true);
      expect(judgeQuestion(topic, i, tileWords(p.q.es).join(' ')).right).toBe(true);
      // an answer that repeats the question (¡Qué onda! ¿Cómo estás?) contains it, so only the others are rejected
      const q = tileWords(p.q.es).join(' ').toLowerCase();
      for (const a of p.answers) {
        if (!tileWords(a.es).join(' ').toLowerCase().includes(q)) expect(judgeQuestion(topic, i, a.es).right).toBe(false);
      }
    });
  });

  it('the bank has the question words plus 2 traps', () => {
    topic.pairs.forEach((p, i) => {
      expect(questionBank(topic, i, 9)).toHaveLength(tileWords(p.q.es).length + 2);
    });
  });

  it('the random answer is one of the answers and is stable for the same seed', () => {
    topic.pairs.forEach((p, i) => {
      const n = swapAnswerIndex(topic, i, 42);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(p.answers.length);
      expect(swapAnswerIndex(topic, i, 42)).toBe(n);
    });
  });
});

describe('the run', () => {
  it('goes build, asks, swap, summary and counts right ones', () => {
    let s = startSmallTalk(topic, 1);
    const totals = smalltalkTotals(topic);
    for (let i = 0; i < totals.build; i++) s = answerSmallTalk(s, topic, i % 2 === 0);
    expect(s.step).toBe('asks');
    expect(s.scores.build).toBe(Math.ceil(totals.build / 2));
    for (let i = 0; i < totals.asks; i++) {
      s = answerSmallTalk(s, topic, true, 0);
      expect(s.done).toBe(true);
      expect(answerSmallTalk(s, topic, false)).toBe(s);
      s = nextSmallTalk(s, topic);
    }
    expect(s.step).toBe('swap');
    for (let i = 0; i < totals.swap; i++) s = nextSmallTalk(answerSmallTalk(s, topic, false), topic);
    expect(s.step).toBe('summary');
    expect(s.scores).toEqual({ build: Math.ceil(totals.build / 2), asks: totals.asks, swap: 0 });
  });

  it('Next does nothing before the question is answered', () => {
    let s = startSmallTalk(topic, 1);
    for (let i = 0; i < smalltalkTotals(topic).build; i++) s = answerSmallTalk(s, topic, true);
    expect(nextSmallTalk(s, topic)).toBe(s);
  });
});

describe('save and parse', () => {
  it('round trips through JSON in every part', () => {
    let s = startSmallTalk(topic, 77);
    const states = [s];
    for (let i = 0; i < smalltalkTotals(topic).build; i++) states.push((s = answerSmallTalk(s, topic, true)));
    s = answerSmallTalk(s, topic, true, 1);
    states.push(s);
    s = nextSmallTalk(s, topic);
    states.push(s);
    for (const st of states.filter((x) => x.step !== 'summary')) {
      expect(parseSmallTalk(JSON.parse(JSON.stringify(savedSmallTalk(st))), topics)).toEqual(st);
    }
  });

  it('returns null for junk, an unknown topic and an index out of range', () => {
    const good = savedSmallTalk(startSmallTalk(topic, 1)) as Record<string, unknown>;
    expect(parseSmallTalk(null, topics)).toBeNull();
    expect(parseSmallTalk('x', topics)).toBeNull();
    expect(parseSmallTalk({}, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, id: 'nope' }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, v: 2 }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, step: 'summary' }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, index: smalltalkTotals(topic).build }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, index: -1 }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, scores: { build: 999, asks: 0, swap: 0 } }, topics)).toBeNull();
    expect(parseSmallTalk({ ...good, step: 'asks', done: true, right: true, pick: 99 }, topics)).toBeNull();
    expect(parseSmallTalk(good, [])).toBeNull();
  });
});
