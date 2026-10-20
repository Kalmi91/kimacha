// The language-pair label of the Feedback payload, one format everywhere: "<source>→<target>",
// the language of the prompt first, then the language being learned ("en→es" for an English
// speaker learning Spanish).
type Lang = 'en' | 'es';
export type LanguagePair = `${Lang}→${Lang}`;

export function pairOf(target: Lang): LanguagePair {
  return target === 'es' ? 'en→es' : 'es→en';
}
