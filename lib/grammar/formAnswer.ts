// A gépelt form-feladat (GrammarDrill) és a lecke-teszt közös ellenőrzője. Az
// `answer` a fő alak (ezt mutatjuk hibánál), az `accept` további helyes alakok
// (rövidített alak, szinonim). Az összehasonlítás kis-nagybetű-független, a
// telefon "okos" aposztrófját (’) az egyenesre (') cseréli; az `accept` nélküli
// tételeknél a viselkedés a korábbi (trim + kisbetű).

interface FormAnswerSource {
  answer: string;
  accept?: string[];
}

const norm = (text: string): string => text.trim().toLowerCase().replace(/[’‘]/g, "'");

/** A tétel összes elfogadott alakja: előbb a fő alak, utána az `accept`. */
export function formAnswers(item: FormAnswerSource): string[] {
  return [item.answer, ...(item.accept ?? [])];
}

export function isFormAnswerCorrect(typed: string, item: FormAnswerSource): boolean {
  const t = norm(typed);
  return formAnswers(item).some((a) => norm(a) === t);
}

/** A lecke-teszt "type" kártyájának válasza: a perjeles forma vagylagos alakokat jelent. */
export function formAnswerForCard(item: FormAnswerSource): string {
  return item.accept && item.accept.length > 0 ? formAnswers(item).join(' / ') : item.answer;
}
