import fs from 'fs';
import path from 'path';

// FB726: a gap whose right answer is a number word ("treinta y ___ años") must say which number, as "(31)", in the sentence
// of the gap; nothing else in the sentence tells it. Checked on every Spanish lesson's opencloze and bank items.
const DIR = path.join(__dirname, '..', '..', '..', 'data', 'games', 'grammar', 'es');
const NUM = /^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti\p{L}*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mil|mill[oó]n|\p{L}*cientos|primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[eé]ptim[oa]|octav[oa]|noven[oa]|d[eé]cim[oa]|\d+)$/iu;

// items whose number needs no digit cue, with the reason
const ALLOW: Record<string, string> = {
  'nh-bank-01': 'the choice is the gender form of one (un/una/uno), "amiga" decides it, not a number to guess',
  'nh-bank-02': 'cien/ciento: the next word "veinte" in the sentence shows the number',
  'nh-bank-03': 'primero/primer: the choice is the form of the ordinal, the date is in the sentence ("de mayo")',
};

type Item = { id?: string; kind?: string; text?: string; es?: string; answers?: string[]; answer?: string };

function items(): Item[] {
  const out: Item[] = [];
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      const it = o as Item;
      if (it.id && (it.kind === 'opencloze' || it.kind === 'bank')) out.push(it);
      Object.values(o).forEach(walk);
    }
  };
  for (const f of fs.readdirSync(DIR)) walk(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  return out;
}

describe('number-word gaps carry a digit cue (FB726)', () => {
  it('every opencloze / bank gap answered by a number word has a "(digits)" cue in its sentence, or is on the allowlist', () => {
    const bad: string[] = [];
    for (const it of items()) {
      const text = (it.kind === 'bank' ? it.es : it.text) ?? '';
      const answers = it.kind === 'bank' ? [it.answer ?? ''] : it.answers ?? [];
      const parts = text.split('___');
      answers.forEach((a, i) => {
        if (!NUM.test(a.trim()) || ALLOW[it.id!]) return;
        // the rest of the gap's sentence (up to the next sentence end)
        const after = (parts[i + 1] ?? '').split(/[.!?]/)[0];
        if (!/\(\s*\d[\d:.,]*\s*\)/.test(after) && !/\d/.test(parts[i] ?? '')) bad.push(`${it.id}: "${a}"`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('the allowlist only names items that exist', () => {
    const ids = new Set(items().map((i) => i.id));
    for (const id of Object.keys(ALLOW)) expect(ids.has(id)).toBe(true);
  });

  it('nh-cloze-02 gives the number of the age', () => {
    const it = items().find((i) => i.id === 'nh-cloze-02')!;
    expect(it.text).toContain('treinta y ___ años (31)');
  });
});
