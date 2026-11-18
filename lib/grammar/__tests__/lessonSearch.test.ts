import { filterTopicsBySearch, normalizeSearch, topicMatchesSearch } from '../lessonSearch';

const topic = (id: string, en: string, es: string) => ({ id, title: { en, es } as Record<string, string> });
const A = topic('a', 'Past tense', 'Pretérito perfecto');
const B = topic('b', 'Pronouns', 'Pronombres');
const C = topic('c', 'Articles', 'Artículos');

describe('lesson search', () => {
  it('normalizes case, accents and spaces', () => {
    expect(normalizeSearch('  PretÉrito   Perfecto ')).toBe('preterito perfecto');
  });

  it('matches without accents or case, and a substring anywhere in the title', () => {
    expect(topicMatchesSearch(A, 'preterito', ['en', 'es'])).toBe(true);
    expect(topicMatchesSearch(A, 'PRETÉRITO', ['en', 'es'])).toBe(true);
    expect(topicMatchesSearch(A, 'perf', ['en', 'es'])).toBe(true);
    expect(topicMatchesSearch(A, 'xyz', ['en', 'es'])).toBe(false);
  });

  it('looks in both the interface title and the target-language title', () => {
    expect(topicMatchesSearch(B, 'pron', ['en', 'es'])).toBe(true);
    expect(topicMatchesSearch(B, 'pronombres', ['en'])).toBe(false);
    expect(topicMatchesSearch(B, 'pronombres', ['en', 'es'])).toBe(true);
    expect(topicMatchesSearch(B, 'pronouns', ['hu', 'es'])).toBe(true); // English is always searched
  });

  it('an empty or blank query keeps every lesson, in order', () => {
    expect(filterTopicsBySearch([A, B, C], '', ['en'])).toEqual([A, B, C]);
    expect(filterTopicsBySearch([A, B, C], '   ', ['en'])).toEqual([A, B, C]);
  });

  it('keeps only the matching lessons', () => {
    expect(filterTopicsBySearch([A, B, C], 'pron', ['en', 'es'])).toEqual([B]);
    expect(filterTopicsBySearch([A, B, C], 'articulo', ['en', 'es'])).toEqual([C]);
    expect(filterTopicsBySearch([A, B, C], 'nothing', ['en', 'es'])).toEqual([]);
  });
});
