// "Within a level and band, two words must not have a
// prompt (English or Hungarian gloss) from which it cannot be decided which one is
// being asked." This module is the only place where the overlap rule lives: the
// "prompt policy" description in lib/__tests__/corpusIntegrity.test.ts calls it.
//
// Conjugated-form items ("ir (fuimos)") do not count as an
// overlap, the parenthesized form already disambiguates; the caller filters them out
// with isConjugatedForm before passing the list to findPromptOverlaps.

export type PromptLang = 'en' | 'es' | 'hu';

interface PromptOverlapWord {
  id: number;
  headword: string;
  prompt: string;
}

interface PromptOverlapCluster {
  kind: 'exact' | 'partial';
  // for partial: the overlapping normalized sense that formed the cluster;
  // for exact: null (the whole prompt is identical, so there is no single "reason" sense).
  sense: string | null;
  words: PromptOverlapWord[];
}

const ARTICLES: Record<PromptLang, RegExp | null> = {
  en: /^(the|a|an)\s+/,
  es: /^(el|la|los|las|un|una|unos|unas)\s+/,
  hu: /^az?\s+/,
};

export function isConjugatedForm(headword: string): boolean {
  return headword.includes('(');
}

function stripArticle(sense: string, lang: PromptLang): string {
  const re = ARTICLES[lang];
  return re ? sense.replace(re, '') : sense;
}

function normalizeSense(raw: string, lang: PromptLang): string {
  return stripArticle(raw.trim().toLowerCase(), lang).replace(/[.\s]+$/, '').trim();
}

// The " / "-separated glosses of the prompt, each normalized. The
// parenthesis is part of the sense disambiguation, so it is kept
// HERE; only bareSense() strips it.
export function promptSenses(prompt: string, lang: PromptLang): string[] {
  return prompt
    .split(' / ')
    .map((part) => normalizeSense(part, lang))
    .filter(Boolean);
}

// "time (clock)" -> "time": the bare form after stripping the parenthesis, this gives
// the "identical after stripping the parenthesis" case (e.g. "time" vs
// "time (clock)" is just as ambiguous for the learner).
export function bareSense(sense: string): string {
  return sense.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function normalizedPrompt(prompt: string, lang: PromptLang): string {
  return promptSenses(prompt, lang).join(' / ');
}

/**
 * Overlap clusters of a word list within a level. The caller passes a list already
 * filtered to one (band, level) pair, without conjugated forms. It works in two passes:
 *   1. EXACT, the whole normalized prompt (senses joined) is identical word for word.
 *   2. PARTIAL, among the remaining words, those where at least one normalized
 *      sense (or its bare form without the parenthesis) equals one of
 *      another word (article stripping, " / " splitting, parenthesis).
 * A word goes into only one cluster (exact takes precedence), so the two counts
 * (exact/partial) are disjoint, and this gives the numbers of the report.
 */
export function findPromptOverlaps(words: PromptOverlapWord[], lang: PromptLang): PromptOverlapCluster[] {
  const active = words.filter((w) => !isConjugatedForm(w.headword) && w.prompt.trim());
  const clusters: PromptOverlapCluster[] = [];

  // 1) EXACT
  const byFullPrompt = new Map<string, PromptOverlapWord[]>();
  for (const w of active) {
    const key = normalizedPrompt(w.prompt, lang);
    const list = byFullPrompt.get(key) ?? [];
    list.push(w);
    byFullPrompt.set(key, list);
  }
  const exactIds = new Set<number>();
  for (const list of byFullPrompt.values()) {
    if (list.length < 2) continue;
    clusters.push({ kind: 'exact', sense: null, words: list });
    for (const w of list) exactIds.add(w.id);
  }

  // 2) PARTIAL, only among those that are not already exact duplicates.
  const rest = active.filter((w) => !exactIds.has(w.id));
  // Three indexes: the full sense (with the parenthesis), the BARE senses
  // (no parenthesis), and the stripped form of the parenthesized senses. Two words
  // collide if a full sense of theirs is identical, OR the bare sense of one
  // equals the stripped form of the other's parenthesized sense ("time" vs
  // "time (clock)"). Two DIFFERENT parenthesized forms ("cold (illness)" vs
  // "cold (temperature)") do not collide: that is exactly the point.
  const keyIndex = new Map<string, PromptOverlapWord[]>();
  const bareIndex = new Map<string, PromptOverlapWord[]>();
  const parenIndex = new Map<string, PromptOverlapWord[]>();
  const push = (index: Map<string, PromptOverlapWord[]>, key: string, w: PromptOverlapWord) => {
    const list = index.get(key) ?? [];
    if (!list.includes(w)) list.push(w);
    index.set(key, list);
  };
  for (const w of rest) {
    for (const sense of promptSenses(w.prompt, lang)) {
      push(keyIndex, sense, w);
      const bare = bareSense(sense);
      if (bare === sense) push(bareIndex, bare, w);
      else push(parenIndex, bare, w);
    }
  }
  // Union-find over the `rest` list.
  const indexOf = new Map(rest.map((w, i) => [w.id, i] as const));
  const parent = rest.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (const list of keyIndex.values()) {
    if (list.length < 2) continue;
    const first = indexOf.get(list[0].id)!;
    for (let j = 1; j < list.length; j++) union(first, indexOf.get(list[j].id)!);
  }
  for (const [bare, bareWords] of bareIndex) {
    const parenWords = parenIndex.get(bare);
    if (!parenWords) continue;
    const first = indexOf.get(bareWords[0].id)!;
    for (const w of bareWords) union(first, indexOf.get(w.id)!);
    for (const w of parenWords) union(first, indexOf.get(w.id)!);
  }
  const groups = new Map<number, PromptOverlapWord[]>();
  rest.forEach((w, i) => {
    const r = find(i);
    const list = groups.get(r) ?? [];
    list.push(w);
    groups.set(r, list);
  });
  for (const groupWords of groups.values()) {
    if (groupWords.length < 2) continue;
    const groupIds = new Set(groupWords.map((w) => w.id));
    let sense: string | null = null;
    for (const [key, kwords] of keyIndex) {
      if (kwords.filter((w) => groupIds.has(w.id)).length >= 2) {
        sense = key;
        break;
      }
    }
    if (sense === null) {
      // bare vs parenthesized collision: the shared stripped form is the label
      for (const [bare, bareWords] of bareIndex) {
        const parenWords = parenIndex.get(bare) ?? [];
        if (bareWords.some((w) => groupIds.has(w.id)) && parenWords.some((w) => groupIds.has(w.id))) {
          sense = bare;
          break;
        }
      }
    }
    clusters.push({ kind: 'partial', sense, words: groupWords });
  }

  return clusters;
}

// the English prompt must never contain the Spanish headword,
// because it gives away the answer. The headword is the normalized "es" field: without the article, parenthesis
// and the alternative after " / ", lowercased (with the same helpers
// as the other rules); it does not run for a headword shorter than 3 letters (e.g. "no", it would
// give too many accidental English matches). Cognate cards (e.g.
// "el hotel" / "the hotel") are not errors: excluded if the stripped en prompt
// as a whole, or its "/" or ","-separated member (the corpus uses both form separators,
// see the "senses" helper of the file in corpusIntegrity.test.ts),
// is the headword itself.
export function headwordLeaks(
  words: PromptOverlapWord[],
  lang: PromptLang
): { id: number; headword: string; prompt: string }[] {
  if (lang !== 'en') return [];
  const leaks: { id: number; headword: string; prompt: string }[] = [];
  for (const w of words) {
    const [firstSense] = promptSenses(w.headword, 'es');
    const key = firstSense ? bareSense(firstSense) : '';
    if (key.length < 3) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${escaped}\\b`).test(w.prompt.toLowerCase())) continue;
    const trimmedPrompt = bareSense(normalizeSense(w.prompt, 'en'));
    const altParts = trimmedPrompt.split(/[/,]/).map((part) => part.trim());
    if (trimmedPrompt === key || altParts.includes(key)) continue;
    leaks.push({ id: w.id, headword: w.headword, prompt: w.prompt });
  }
  return leaks;
}
