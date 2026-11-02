// The language-pair label of the Feedback payload, one format everywhere: "<source>→<target>",
// the language of the prompt first, then the language being learned ("en→es" for an English
// speaker learning Spanish).
export type Lang = 'en' | 'es' | 'hu' | 'de';
export type LanguagePair = `${Lang}→${Lang}`;

const isLang = (s: string | null | undefined): s is Lang => s === 'en' || s === 'es' || s === 'hu' || s === 'de';

// The learner's native language for a target. `source` is the stored onboarding source; without a
// usable one (before onboarding, or a stale value equal to the target) the default counterpart of the
// target is used: English for Spanish and German, Spanish for English and Hungarian (the two original
// pairs, en-es and es-en, always meant that).
export function sourceFor(target: Lang, source?: string | null): Lang {
  if (isLang(source) && source !== target) return source;
  return target === 'es' || target === 'de' ? 'en' : 'es';
}

// The native language of the active pair, set together with the active deck (data/pcic.ts setPcicTarget), so
// the modules that only know the target (sentence cards, gap-fill, ...) can still name the prompt side.
let activeSource: string | null = null;

export function setActiveSource(source: string | null | undefined): void {
  activeSource = source ?? null;
}

/** The source of the active pair for `target` (the default counterpart when none is set). */
export function activeSourceFor(target: Lang): Lang {
  return sourceFor(target, activeSource);
}

export function pairOf(target: Lang, source?: string | null): LanguagePair {
  return `${sourceFor(target, source ?? activeSource)}→${target}`;
}
