// NY2 (NYELVTAN.md "Unlock-modell"): a téma zár-állapota a transform itemek
// wordId-uniójából és a hívó által adott "ismert szó" halmazból dől el.

import { lessonWordIds, lockState, MIN_FOCUS_WORDS, transformWordIds } from '@/lib/grammar/lockState';
import type { LessonV2, TransformItem } from '@/lib/grammar/lessonTypes';
import type { LegacyLesson } from '@/lib/games/content';
import { lessonFor } from '@/lib/grammar/syllabus';
import { getWordsForTopic } from '@/data/words';

const lang4 = (v: string) => ({ hu: v, en: v, es: v, de: v });

function transformItem(id: string, wordIds: string[]): TransformItem {
  return {
    kind: 'transform',
    id,
    tense: { from: 'presente', to: 'indefinido' },
    prompt: lang4('Como pan.'),
    answer: 'Comí pan.',
    wordIds,
    why: lang4('porque sí'),
  };
}

function lessonV2(items: LessonV2['items']): LessonV2 {
  return {
    schema: 2,
    topic: 'fixture-topic',
    level: 'A2',
    title: lang4('Fixture'),
    body: [],
    speak: lang4('fixture'),
    items,
  };
}

describe('transformWordIds', () => {
  it('unions the wordIds of the transform items, first-occurrence order', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2']), transformItem('t2', ['2', '3'])]);
    expect(transformWordIds(lesson)).toEqual(['1', '2', '3']);
  });

  it('is empty for a lesson with no transform items', () => {
    const lesson = lessonV2([]);
    expect(transformWordIds(lesson)).toEqual([]);
  });

  it('is empty for a non-V2 (legacy) lesson', () => {
    const legacy: LegacyLesson = {
      topic: 'legacy',
      level: 'A1',
      title: lang4('Legacy'),
      rule: lang4('rule'),
      items: [],
    };
    expect(transformWordIds(legacy)).toEqual([]);
  });
});

// FB318: a valódi indefinido-10-verbos lecke `focusTopic`-os, a szó-halmaza a
// transform-szavak ÉS a témakör 60 kártyájának uniója.
describe('lessonWordIds', () => {
  it('unions the transform words and the focusTopic cards on the real lesson', () => {
    const lesson = lessonFor('es', 'indefinido-10-verbos');
    if (!lesson) throw new Error('indefinido-10-verbos lesson not found');
    const ids = lessonWordIds(lesson);
    const transformIds = transformWordIds(lesson);
    const topicIds = getWordsForTopic('A2', 'indefinido_10_verbos').map((w) => String(w.id));
    for (const id of transformIds) expect(ids).toContain(id);
    for (const id of topicIds) expect(ids).toContain(id);
    expect(topicIds).toHaveLength(60);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('equals transformWordIds for a lesson without focusTopic', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2']), transformItem('t2', ['2', '3'])]);
    expect(lessonWordIds(lesson)).toEqual(transformWordIds(lesson));
  });
});

// FB349: a lecke-zár megszűnt, lockState már csak a "Ezen szavak tanulása"
// gomb N-jéhez adja a have/need párt.
describe('lockState', () => {
  it('need equals the union size on the real focusTopic lesson', () => {
    const lesson = lessonFor('es', 'indefinido-10-verbos');
    if (!lesson) throw new Error('indefinido-10-verbos lesson not found');
    expect(lockState(lesson, new Set()).need).toBe(lessonWordIds(lesson).length);
  });

  it('have counts only the known words, on a partially known lesson', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2', '3'])]);
    const known = new Set(['1']);
    expect(lockState(lesson, known)).toEqual({ have: 1, need: 3 });
  });

  it('have equals need when all needed words are known', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2'])]);
    const known = new Set(['1', '2']);
    expect(lockState(lesson, known)).toEqual({ have: 2, need: 2 });
  });

  it('0/0 when the lesson has no transform items', () => {
    const lesson = lessonV2([]);
    expect(lockState(lesson, new Set())).toEqual({ have: 0, need: 0 });
  });

  it('0/n on an empty known set', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2'])]);
    expect(lockState(lesson, new Set())).toEqual({ have: 0, need: 2 });
  });

  it('counts a wordId duplicated across two items once', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2']), transformItem('t2', ['2', '1'])]);
    const known = new Set(['1', '2']);
    expect(lockState(lesson, known)).toEqual({ have: 2, need: 2 });
  });
});

// FB343 (grammar:ir-a-infinitivo:lesson): a küszöb maga csak egy konstans itt,
// a gomb megjelenését a screen-teszt (app/grammar/__tests__/learnWordsButton.test.tsx)
// fedi le 6 és 28 szavas fixture-rel.
describe('MIN_FOCUS_WORDS', () => {
  it('is 10', () => {
    expect(MIN_FOCUS_WORDS).toBe(10);
  });
});
