// Why-item give-away rule (audit-games P1). CommonJS so that both scripts/audit-games.mjs and the jest test can load it.
// A why item asks "why this word / form in this sentence"; the options must make the learner know the rule, so:
//  1. no option, in any language, holds a parenthesis (it usually names the answer or the form);
//  2. the right option does not contain the `target` word (or a form of it) unless every option does,
//     otherwise the learner can match the word instead of knowing the rule.
function strip(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function tokens(s) {
  return strip(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// true when `text` holds the target as a whole word/phrase (accents and case ignored) or a form of it:
// a single-word target of 6+ letters also matches a word that starts with its first (length - 2) letters.
function containsTarget(text, target) {
  const tt = tokens(target);
  if (tt.length === 0) return false;
  const tk = tokens(text);
  if (tt.length === 1) {
    const t = tt[0];
    const stem = t.length >= 6 ? t.slice(0, t.length - 2) : t;
    return tk.some((w) => w === t || (t.length >= 6 && w.length >= stem.length && w.startsWith(stem)));
  }
  for (let i = 0; i + tt.length <= tk.length; i++) {
    if (tt.every((w, j) => tk[i + j] === w)) return true;
  }
  return false;
}

// Returns a list of issue strings (empty = clean) for one why item.
function whyGiveaways(item) {
  const issues = [];
  const options = Array.isArray(item?.options) ? item.options : [];
  options.forEach((opt, i) => {
    for (const [lang, text] of Object.entries(opt?.text ?? {})) {
      if (/[(（]/.test(String(text))) issues.push(`why option ${i} text.${lang} holds a parenthesis (it names the answer)`);
    }
  });
  const target = item?.target;
  if (target && typeof item.correctIndex === 'number' && options[item.correctIndex]) {
    const has = options.map((o) => Object.values(o?.text ?? {}).some((t) => containsTarget(t, target)));
    if (has[item.correctIndex] && !has.every(Boolean)) {
      issues.push(`why right option contains the target "${target}" and not every option does (the learner can match the word)`);
    }
  }
  return issues;
}

module.exports = { whyGiveaways, containsTarget };
