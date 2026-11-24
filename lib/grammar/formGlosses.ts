// FB724: per-language extra form glosses (shape: { "<normalized token>": { "<content lang>": "<meaning>" } }),
// shared by the lesson page's worked examples and its "Words in the exercises" list.
type FormGlossMap = Record<string, Record<string, string>>;

const cache: Record<string, FormGlossMap> = {};

export function formGlosses(learnedLang: string): FormGlossMap {
  const hit = cache[learnedLang];
  if (hit) return hit;
  let data: FormGlossMap = {};
  if (learnedLang === 'es') data = require('@/data/games/grammar-forms/es.json');
  else if (learnedLang === 'en') data = require('@/data/games/grammar-forms/en.json');
  else if (learnedLang === 'de') data = require('@/data/games/grammar-forms/de.json');
  else if (learnedLang === 'hu') data = require('@/data/games/grammar-forms/hu.json');
  cache[learnedLang] = data;
  return data;
}
