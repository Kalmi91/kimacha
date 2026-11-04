// The stories of the Speak tab (data/speech/stories.json, lib/speech/stories.ts). A story's lines and answers are Spanish, everything
// else is in the four interface languages. Never an unknown word: every token of what the character says and of the model answers is
// a form the story teaches itself or a name. The models are accepted by their own answers, and the grammar stays inside the level.
import { PCIC_LEVELS, type PcicLevel } from '@/data/pcic';
import storiesData from '@/data/speech/stories.json';
import { CORPUS_NAMES } from '@/lib/corpusNames';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { sentenceTokens } from '@/lib/knownSentence';
import type { Lang } from '@/lib/languagePair';
import { matchSpoken } from '@/lib/practice/situationMatch';
import { STORIES, lineOf, storiesFor, type StoryText } from '@/lib/speech/stories';

const LANGS: Lang[] = ['en', 'es', 'hu', 'de'];
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
const filled = (model: string) => model.replace(/_+/g, SAMPLE);
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

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: every text exists in the four languages', (_id, s) => {
    const texts: StoryText[] = [s.title, s.teaser, s.intro, s.outro, ...s.words, ...s.turns, ...s.turns.map((turn) => turn.ask)];
    for (const text of texts) for (const lang of LANGS) expect(text[lang].trim()).not.toBe('');
    for (const w of s.words) expect(w.forms.length).toBeGreaterThan(0);
    expect(s.turns.length).toBeGreaterThan(0);
  });

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: every token of the lines and the models is a form of the story or a name', (_id, s) => {
    const own = new Set(s.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
    const names = new Set([...CORPUS_NAMES.es.flatMap((n) => sentenceTokens(n, 'es')), ...sentenceTokens(s.speaker, 'es')]);
    for (const turn of s.turns) {
      for (const text of [lineOf(s, turn), blanked(turn.model)]) {
        for (const token of sentenceTokens(text, 'es')) expect({ text, token, ok: own.has(token) || names.has(token) }).toMatchObject({ ok: true });
      }
    }
  });

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: the model answer of every turn is accepted by its own answers', (_id, s) => {
    for (const turn of s.turns) {
      expect(turn.answers.length).toBeGreaterThan(0);
      const heard = filled(turn.model);
      expect({ heard, right: matchSpoken(heard, turn.answers, { anyNumber: turn.anyNumber, lang: 'es' }).right }).toEqual({ heard, right: true });
      // typed with the accents the setting asks for, it is right too
      expect(matchSpoken(heard, turn.answers, { anyNumber: turn.anyNumber, lang: 'es', strictAccents: true }).right).toBe(true);
    }
  });

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: every accepted answer is accepted, and a wrong word is not', (_id, s) => {
    for (const turn of s.turns) {
      for (const answer of turn.answers) {
        const heard = sayable(answer);
        expect({ heard, right: matchSpoken(heard, turn.answers, { anyNumber: turn.anyNumber, lang: 'es' }).right }).toEqual({ heard, right: true });
      }
      // an unrelated sentence is not an answer
      expect(matchSpoken('la mesa es azul', turn.answers, { anyNumber: turn.anyNumber, lang: 'es' }).right).toBe(false);
    }
  });

  it.each(STORIES.map((s) => [s.id, s] as const))('%s: the lines and the models stay inside the grammar of the level', (_id, s) => {
    const problems: string[] = [];
    for (const turn of s.turns) {
      for (const text of [lineOf(s, turn), blanked(turn.model)]) {
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
