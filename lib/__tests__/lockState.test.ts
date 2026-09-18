// NY2 (NYELVTAN.md "Unlock-modell"): a téma zár-állapota a transform itemek
// wordId-uniójából és a hívó által adott "ismert szó" halmazból dől el.

import { lockState, transformWordIds } from '@/lib/grammar/lockState';
import type { LessonV2, TransformItem } from '@/lib/grammar/lessonTypes';
import type { LegacyLesson } from '@/lib/games/content';

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

describe('lockState', () => {
  it('locked when only some of the needed words are known', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2', '3'])]);
    const known = new Set(['1']);
    expect(lockState(lesson, known)).toEqual({ state: 'locked', have: 1, need: 3 });
  });

  it('unlocked when all needed words are known', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2'])]);
    const known = new Set(['1', '2']);
    expect(lockState(lesson, known)).toEqual({ state: 'unlocked', have: 2, need: 2 });
  });

  it('unlocked with 0/0 when the lesson has no transform items', () => {
    const lesson = lessonV2([]);
    expect(lockState(lesson, new Set())).toEqual({ state: 'unlocked', have: 0, need: 0 });
  });

  it('locked with 0/n on an empty known set', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2'])]);
    expect(lockState(lesson, new Set())).toEqual({ state: 'locked', have: 0, need: 2 });
  });

  it('counts a wordId duplicated across two items once', () => {
    const lesson = lessonV2([transformItem('t1', ['1', '2']), transformItem('t2', ['2', '1'])]);
    const known = new Set(['1', '2']);
    expect(lockState(lesson, known)).toEqual({ state: 'unlocked', have: 2, need: 2 });
  });
});
