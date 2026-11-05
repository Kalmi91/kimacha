// The typed-mistake map of the grammar form items (`wrong`): the checks of scripts/audit-form-wrong.mjs, kept apart
// so a unit test can reach them (lib/grammar/__tests__/formWrongAudit.test.ts).

/** The same key normalization as normTyped() in lib/grammar/resultDetail.ts: lowercase, accents and extra spaces removed. */
const normTyped = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The form items of a lesson (kind 'form'). */
const formItems = (lesson) => (Array.isArray(lesson && lesson.items) ? lesson.items.filter((i) => i && i.kind === 'form') : []);

/**
 * P1 problems of the `wrong` maps in one lesson: a key that is the item's right answer after normalization
 * (the typed right answer would be explained as a mistake), an empty key, two keys that normalize the same.
 * @returns {string[]} one message per problem
 */
function wrongKeyViolations(lesson, where = '') {
  const out = [];
  for (const item of formItems(lesson)) {
    if (!item.wrong) continue;
    const answer = normTyped(item.answer || '');
    const seen = new Set();
    for (const key of Object.keys(item.wrong)) {
      const k = normTyped(key);
      const at = `${where}${item.id}: wrong key "${key}"`;
      if (k === '') out.push(`${at} is empty`);
      else if (k === answer) out.push(`${at} equals the right answer "${item.answer}" after normalization`);
      else if (seen.has(k)) out.push(`${at} normalizes to the same key as another key of the item`);
      seen.add(k);
    }
  }
  return out;
}

/** { total, withWrong } of the form items of one lesson. */
function wrongCount(lesson) {
  const items = formItems(lesson);
  return { total: items.length, withWrong: items.filter((i) => i.wrong && Object.keys(i.wrong).length > 0).length };
}

module.exports = { normTyped, formItems, wrongKeyViolations, wrongCount };
