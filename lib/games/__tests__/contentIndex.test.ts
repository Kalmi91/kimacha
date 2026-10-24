import { readdirSync } from 'fs';
import { join } from 'path';
import { getGrammarTopic, getGrammarTopicIds, getGrammarTopics } from '../content';
import { EN_GRAMMAR_INDEX } from '../content/en.index';
import { ES_GRAMMAR_INDEX } from '../content/es.index';
import { HU_GRAMMAR_INDEX } from '../content/hu.index';
import { withArticleNouns } from '@/lib/grammar/nounArticles';
import { withHu } from '@/lib/grammar/huOverlay';

const INDEXES = { es: ES_GRAMMAR_INDEX, en: EN_GRAMMAR_INDEX, hu: HU_GRAMMAR_INDEX };
const DATA = join(__dirname, '..', '..', '..', 'data', 'games', 'grammar');

// file name -> the JSON's own `topic` id, read straight from the data folder
function filesOf(lang: 'es' | 'en' | 'hu'): { file: string; json: { topic: string } }[] {
  return readdirSync(join(DATA, lang))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f.slice(0, -5), json: require(`@/data/games/grammar/${lang}/${f}`) }));
}

describe.each(['es', 'en', 'hu'] as const)('lazy grammar registry (%s)', (lang) => {
  const index = INDEXES[lang];
  const files = filesOf(lang);

  it('lists exactly the lessons in data/games/grammar (none missing, none orphaned)', () => {
    const ids = index.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(files.map((f) => f.json.topic).sort());
    expect(getGrammarTopicIds(lang)).toEqual(ids);
  });

  it('returns the lesson JSON with its Hungarian sidecar laid over it (article nouns added where they belong; the hu course has no sidecar)', () => {
    for (const { file, json } of files) {
      const lesson = getGrammarTopic(lang, json.topic);
      if (lang === 'hu') {
        expect(lesson).toEqual(json);
        continue;
      }
      const withSidecar = withHu(json, require(`@/data/games/grammar-hu/${lang}/${file}.json`));
      if (lang === 'es' && json.topic === 'articulos-genero') {
        expect(lesson).toEqual(withArticleNouns(withSidecar as never));
      } else {
        expect(lesson).toEqual(withSidecar);
      }
    }
  });

  it('loads a lesson once: the second call hands back the same object', () => {
    const id = index[0].id;
    expect(getGrammarTopic(lang, id)).toBe(getGrammarTopic(lang, id));
    expect(getGrammarTopics(lang)).toBe(getGrammarTopics(lang));
  });

  it('getGrammarTopics keeps the registry order and shares the per-topic objects', () => {
    const topics = getGrammarTopics(lang);
    expect(topics.map((t) => t.topic)).toEqual(index.map((e) => e.id));
    topics.forEach((t) => expect(t).toBe(getGrammarTopic(lang, t.topic)));
  });

  it('an unknown id has no lesson', () => {
    expect(getGrammarTopic(lang, 'no-such-topic')).toBeUndefined();
  });
});

it('an unknown language has no lessons', () => {
  expect(getGrammarTopics('xx')).toEqual([]);
  expect(getGrammarTopicIds('xx')).toEqual([]);
});
