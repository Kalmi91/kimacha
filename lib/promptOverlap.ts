// PROMPT-POLICY 1: "Egy szinten és sávon belül két szónak nem lehet olyan
// prompt (angol vagy magyar gloss)ja, amelyből nem dönthető el, melyik a
// kérdezett." Ez a modul az egyetlen hely, ahol az átfedés-szabály él: a
// scripts/audit-prompts.mjs (node ESM, TS-t nem tud importálni, ezért a
// logika ott duplikálva van, ld. a szkript fejléc-kommentjét, "keep in
// sync") és a lib/__tests__/corpusIntegrity.test.ts "prompt policy" leírása
// egyaránt ezt hívja/tükrözi.
//
// PROMPT-POLICY 8: a ragozott-alak tételek ("ir (fuimos)") nem számítanak
// átfedésnek, a zárójeles alak már egyértelműsít, ezeket a hívó szűri ki
// isConjugatedForm-mal, mielőtt findPromptOverlaps-nak átadná.

export type PromptLang = 'en' | 'es' | 'hu';

export interface PromptOverlapWord {
  id: number;
  headword: string;
  prompt: string;
}

export interface PromptOverlapCluster {
  kind: 'exact' | 'partial';
  // partial esetén az átfedő normalizált sense, ami miatt a fürt összeállt;
  // exact esetén null (ott a teljes prompt azonos, nincs egyetlen "ok" sense).
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

export function normalizeSense(raw: string, lang: PromptLang): string {
  return stripArticle(raw.trim().toLowerCase(), lang).replace(/[.\s]+$/, '').trim();
}

// A prompt " / "-vel elválasztott glosszai, mindegyik normalizálva. A
// zárójel a jelentés-egyértelműsítés része (PROMPT-POLICY 2), ezért ITT
// megmarad, csak a bareSense() vágja le.
export function promptSenses(prompt: string, lang: PromptLang): string[] {
  return prompt
    .split(' / ')
    .map((part) => normalizeSense(part, lang))
    .filter(Boolean);
}

// "time (clock)" -> "time": a zárójel levágása utáni csupasz alak, ez adja
// a PROMPT-POLICY 1 "zárójel levágása után azonos" esetét (pl. "time" vs
// "time (clock)" a tanulónak ugyanúgy kétértelmű).
export function bareSense(sense: string): string {
  return sense.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function normalizedPrompt(prompt: string, lang: PromptLang): string {
  return promptSenses(prompt, lang).join(' / ');
}

/**
 * Egy szinten belüli szólista átfedés-fürtjei. A hívó már egy (sáv, szint)
 * párra szűrt, ragozott-alak nélküli listát ad át. Két menetben dolgozik:
 *   1. EXACT, a teljes normalizált prompt (senses összefűzve) szó szerint azonos.
 *   2. PARTIAL, a maradék szavak közül, akiknek legalább egy normalizált
 *      sense-e (vagy annak csupasz, zárójel nélküli alakja) megegyezik egy
 *      másikéval (névelő-levágás, " / "-bontás, PROMPT-POLICY 2 zárójel).
 * Egy szó csak egy fürtbe kerül (exact elsőbbséget élvez), így a két darabszám
 * (exact/partial) diszjunkt, ez adja a PROMPT-POLICY 9 riport-számait.
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

  // 2) PARTIAL, csak azok közt, akik nem már exact-duplikátumok.
  const rest = active.filter((w) => !exactIds.has(w.id));
  // Három index: a teljes sense (zárójellel együtt), a CSUPASZ sense-ek
  // (nincs zárójel), és a zárójeles sense-ek levágott alakja. Két szó akkor
  // ütközik, ha egy teljes sense-ük azonos, VAGY az egyik csupasz sense-e
  // egyenlő a másik zárójeles sense-ének levágott alakjával ("time" vs
  // "time (clock)"). Két KÜLÖNBÖZŐ zárójeles alak ("cold (illness)" vs
  // "cold (temperature)") nem ütközik: pont ez a PROMPT-POLICY 2 megoldása.
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
  // Union-find a `rest` listán.
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
      // csupasz vs zárójeles ütközés: a közös levágott alak a címke
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
