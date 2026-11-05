// Why-item give-away rule (audit-games P1). CommonJS so that both scripts/audit-games.mjs and the jest test can load it.
// A why item asks "why this word / form in this sentence"; the options must make the learner know the rule, so:
//  1. no option text, in any language, holds a parenthesis or a square bracket (it usually names the answer or the form);
//  2. the right option does not share a word with the `target` that not every option shares (the learner could match the
//     word instead of knowing the rule); forms count (shared 4-letter stem, singular/plural);
//  3. the right option does not share a word of 4+ letters of the sentence that no other option shares.
function strip(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function tokens(s) {
  return strip(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// the same word or a form of it: equal, or both 3+ letters and one starts with the first min(4, shorter length) letters of the other
function sameWord(a, b) {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  const short = Math.min(a.length, b.length);
  if (short === 3) { // "ojo" is "ojos", but "the" is not "there" or "then"
    const [x, y] = a.length < b.length ? [a, b] : [b, a];
    return y === x + 's' || y === x + 'es';
  }
  const n = Math.min(4, short);
  return a.slice(0, n) === b.slice(0, n) && (a.startsWith(b.slice(0, n)) || b.startsWith(a.slice(0, n)));
}

const BRACKETS = /[()\[\]（）［］]/;

// Returns true when `text` holds the target (any word of it, as a word or a form of it).
function containsTarget(text, target) {
  const tt = tokens(target);
  if (tt.length === 0) return false;
  const tk = tokens(text);
  if (tt.length === 1 || tt.every((w) => w.length < 3)) {
    // short or one-word target: whole phrase, contiguous
    for (let i = 0; i + tt.length <= tk.length; i++) {
      if (tt.every((w, j) => sameWord(tk[i + j], w))) return true;
    }
    return false;
  }
  return tt.some((w) => w.length >= 3 && tk.some((t) => sameWord(t, w)));
}

function containsPhrase(text, target) {
  const tt = tokens(target);
  const tk = tokens(text);
  for (let i = 0; i + tt.length <= tk.length; i++) if (tt.every((w, j) => tk[i + j] === w)) return true;
  return false;
}

// words of the target and of the sentence, as the learner could match them
// function words of the sentences that the explanations use anyway; never counted as a cited sentence word
const STOP = new Set(('the that have they there what were when than will must such this with from been does your would could should shall about after before which while because these those their them then into only more most very some being whom whose here also ' +
  'para como pero esta este esto esos esas todo toda todos todas cada cuando donde desde hasta sobre entre porque tiene hace muy mucho mucha bien ahora siempre nunca tambien').split(' '));

// short function words: not counted as the target word when the target holds other words ("The more", "Had she not helped")
const TARGET_STOP = new Set('the you she her him his its are not was has had did but and for who how can were will'.split(' '));

function matchWords(item) {
  const target = tokens(item?.target ?? '');
  const targetSet = new Set(target);
  const sentence = tokens(item?.es ?? '').filter((w) => w.length >= 4 && !targetSet.has(w) && !STOP.has(w));
  return { target: ((tw) => { const ns = tw.filter((w) => !TARGET_STOP.has(w)); return ns.length || tw.length === 1 ? (ns.length ? ns : tw) : []; })(target.filter((w) => w.length >= 3)), sentence };
}

// exact words of every language; forms (stems) only in the language the sentence is written in (`srcLang`),
// so that English "habit" does not match Spanish "había"
function optionTokens(opt, srcLang) {
  const all = Object.values(opt?.text ?? {}).flatMap((t) => tokens(t));
  const src = srcLang && opt?.text?.[srcLang] ? tokens(opt.text[srcLang]) : [];
  return { all: new Set(all), src };
}

// Returns a list of issue strings (empty = clean) for one why item.
function whyGiveaways(item, srcLang, opts) {
  const issues = [];
  const options = Array.isArray(item?.options) ? item.options : [];
  options.forEach((opt, i) => {
    for (const [lang, text] of Object.entries(opt?.text ?? {})) {
      if (BRACKETS.test(String(text))) issues.push(`why option ${i} text.${lang} holds a parenthesis or bracket (it names the answer)`);
    }
  });
  const ci = item?.correctIndex;
  if (typeof ci !== 'number' || !options[ci] || options.length < 2) return issues;
  const toks = options.map((o) => optionTokens(o, srcLang));
  const shared = (w) => toks.map((tk) => tk.all.has(w) || tk.src.some((t) => sameWord(t, w)));
  const { target, sentence } = matchWords(item);
  // legacy short targets (1 or 2 letters, or a phrase of short words): the old contiguous whole-word test
  if (item.target && target.length === 0) {
    const has = options.map((o) => Object.values(o?.text ?? {}).some((t) => containsPhrase(t, item.target)));
    if (has[ci] && !has.every(Boolean)) issues.push(`why right option contains the target "${item.target}" and not every option does (the learner can match the word)`);
  }
  for (const w of target) {
    const s = shared(w);
    if (s[ci] && !s.every(Boolean)) {
      issues.push(`why right option shares the target word "${w}" and not every option does (the learner can match the word)`);
      break;
    }
  }
  // lexical lessons (which preposition goes with which verb) list the verbs of each group by design: the sentence verb is the knowledge asked
  for (const w of opts?.lexical ? [] : sentence) {
    const s = shared(w);
    if (s[ci] && s.filter(Boolean).length === 1) {
      issues.push(`why right option is the only one citing the sentence word "${w}"`);
      break;
    }
  }
  return issues;
}

// Parenthesis or bracket in an overlay translation of an option text (overlays are keyed by the English text).
function overlayGiveaways(item, overlay) {
  const issues = [];
  (item?.options ?? []).forEach((opt, i) => {
    const v = overlay?.[opt?.text?.en];
    if (typeof v === 'string' && BRACKETS.test(v)) issues.push(`why option ${i} overlay text holds a parenthesis or bracket`);
  });
  return issues;
}

module.exports = { whyGiveaways, overlayGiveaways, containsTarget, sameWord };
