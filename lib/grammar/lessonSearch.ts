// Search on the Grammar tab's lesson list: a lesson stays when what the learner typed is part of its title
// (in the interface language, in English, or in the language being learned), ignoring case and accents.

import type { SyllabusTopic } from './syllabus';

/** Lower case, no accents, single spaces: "  Pretérito  Perfecto " -> "preterito perfecto". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does the topic's title (any of the given languages) contain the typed query? An empty query matches all. */
export function topicMatchesSearch(topic: Pick<SyllabusTopic, 'title'>, query: string, langs: string[]): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const titles = new Set<string>();
  for (const l of [...langs, 'en']) {
    const title = topic.title[l];
    if (title) titles.add(title);
  }
  for (const title of titles) {
    if (normalizeSearch(title).includes(q)) return true;
  }
  return false;
}

/** The topics whose title matches, in the order given; an empty query returns them all. */
export function filterTopicsBySearch<T extends Pick<SyllabusTopic, 'title'>>(topics: T[], query: string, langs: string[]): T[] {
  return normalizeSearch(query) ? topics.filter((tp) => topicMatchesSearch(tp, query, langs)) : topics;
}
