// The stories of the Speak tab (data/speech/stories.json, lib/speech/stories.ts). A story's lines and answers are Spanish, everything
// else is in the four interface languages. Every answer is accepted by its own branch, and the grammar stays inside the level.
import { PCIC_LEVELS, type PcicLevel } from '@/data/pcic';
import storiesData from '@/data/speech/stories.json';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { matchSpoken } from '@/lib/practice/situationMatch';
import { STORIES, judgeAnswer, storiesFor } from '@/lib/speech/stories';

const rank = (level: PcicLevel) => PCIC_LEVELS.indexOf(level);
// The level at which a Spanish structure is taught (lib/grammar/tenseGate.ts STRUCTURE_LEVEL, which is not exported): the same table
// as data/__tests__/stories.test.ts. A structure that is not in it is not allowed in a story of any level.
const STRUCTURE_LEVEL: Partial<Record<string, PcicLevel>> = {
  presente: 'A1',
  indefinido: 'A2',
  imperfecto: 'A2',
  futuro: 'A2',
  condicional: 'B1',
  subjuntivo_presente: 'B1',
  subjuntivo_imperfecto: 'B2',
};
// what the learner would say for the blank of a model answer
const SAMPLE = 'Kálmán';
const blanked = (model: string) => model.replace(/_+/g, ' ');
// the answers with the free slot filled in
const sayable = (answer: string) => answer.replace(/\*/g, SAMPLE);

describe('data/speech/stories.json', () => {
  it('is the list the logic serves, with unique ids and a valid level', () => {
    expect(STORIES).toBe(storiesData);
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    for (const s of STORIES) {
      expect([s.id, PCIC_LEVELS.includes(s.level)]).toEqual([s.id, true]);
      expect(s.id.startsWith(`${s.level.toLowerCase()}-`)).toBe(true);
      expect(s.target).toBe('es');
      expect(s.speaker.trim()).not.toBe('');
    }
    expect(storiesFor('es', 'en')).toHaveLength(STORIES.length);
    for (const other of ['en', 'hu', 'de'] as const) expect(storiesFor(other)).toEqual([]);
  });

  // the graph, the four languages, the known words and the say lines of every story: lib/speech/__tests__/stories.test.ts
  it.each(STORIES.map((s) => [s.id, s] as const))('%s: every accepted answer is accepted by its branch, and a wrong sentence by none', (_id, s) => {
    for (const turn of s.turns) {
      for (const branch of turn.branches) {
        expect(branch.answers.length).toBeGreaterThan(0);
        for (const answer of branch.answers) {
          const heard = sayable(answer);
          expect({ heard, right: matchSpoken(heard, branch.answers, { lang: 'es' }).right }).toEqual({ heard, right: true });
        }
      }
      // an unrelated sentence is not an answer
      expect(judgeAnswer(turn, 'la mesa es azul', { lang: 'es' }).branch).toBeNull();
    }
  });

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: the lines and the models stay inside the grammar of the level', (_id, s) => {
    const problems: string[] = [];
    for (const turn of s.turns) {
      const texts = [turn.es, ...turn.branches.flatMap((b) => [...b.say.map((x) => x.es), ...(b.reply ? [b.reply.es] : [])])];
      for (const text of texts.map(blanked)) {
        // a structure taught above the level of the story (or not taught at all) is another structure
        const other = [...detectStructures(text)].filter((x) => {
          const taught = STRUCTURE_LEVEL[x];
          return taught === undefined || rank(taught) > rank(s.level);
        });
        if (other.length > 0) problems.push(`${s.id}: ${text} | ${other.join(',')}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
