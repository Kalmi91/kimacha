// E149: a lesson finished in the 4.2.1 release must stay finished with the later tasks. The fixture holds, per Spanish
// topic, the kinds the done state needs and the kinds the lesson % averages over, generated from the `v4.2.1` data.
// Adding an item that creates a new kind in a lesson changes these lists and fails here; list the kind in
// data/grammar/late-kinds.json (kept off the done state and the %), or, on purpose, regenerate the fixture.

import { getGrammarTopic, getGrammarTopicIds } from '@/lib/games/content';
import { requiredKinds, scoredKinds } from '../syllabus';

const SNAPSHOT: Record<string, { required: string[]; scored: string[] }> = require('./fixtures/v421-lesson-kinds.json');

describe('lesson done state and % stay as in v4.2.1 (E149)', () => {
  it('the fixture covers exactly the Spanish topics', () => {
    expect(Object.keys(SNAPSHOT).sort()).toEqual([...getGrammarTopicIds('es')].sort());
  });

  it('every Spanish topic needs the same kinds for done and averages over the same kinds as in v4.2.1', () => {
    const diffs: string[] = [];
    for (const id of Object.keys(SNAPSHOT)) {
      const lesson = getGrammarTopic('es', id)!;
      const got = { required: requiredKinds(lesson), scored: scoredKinds(lesson) };
      if (JSON.stringify(got) !== JSON.stringify(SNAPSHOT[id])) diffs.push(`${id}: ${JSON.stringify(got)} != ${JSON.stringify(SNAPSHOT[id])}`);
    }
    expect(diffs).toEqual([]);
  });
});
