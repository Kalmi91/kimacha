// User feedback (`sentence:El calabacín es una verdura verde.`), translated from Hungarian:
// "if I tap ... on calabacín or on courset ... put it among the
// words where I can practise their spelling".
// A tap lands on a token of running text, the spelling list stores word ids, so
// the token has to find its card. Matching forgives what running text adds
// (case, punctuation) and what a headword carries (its article), but never the
// accents: those ARE the spelling being practised.
const TOKEN_PUNCTUATION = /[¿?¡!.,;:«»"'“”‘’()…\-–\u2014]/g;

export function normalizeWordToken(raw: string): string {
  return raw.toLowerCase().replace(TOKEN_PUNCTUATION, '').replace(/\s+/g, ' ').trim();
}
