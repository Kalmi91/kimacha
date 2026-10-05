// PLAN-fb1005e (FB481/495/496/498): a data/words-open/notes.json (i) magyarázatai: minden kulcs egy
// létező `o<order>` kártya, a szöveg angol, rövid, és a Learn-kártya hozzáfér (PcicItem.note).
import notes from '../words-open/notes.json';
import { findPcicItem, setPcicTarget } from '../pcic';

describe('data/words-open/notes.json (i) magyarázatok', () => {
  afterEach(() => setPcicTarget('es'));

  const entries = Object.entries(notes as Record<string, string>);

  it('van legalább egy magyarázat', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('minden kulcs egy létező o<order> kártya, és a PcicItem.note a szöveget hozza', () => {
    setPcicTarget('es');
    const bad: string[] = [];
    for (const [id, text] of entries) {
      const item = /^o\d+$/.test(id) ? findPcicItem(id) : undefined;
      if (!item) bad.push(`${id}: nincs ilyen kártya`);
      else if (item.note !== text) bad.push(`${id}: a kártya note-ja nem egyezik`);
    }
    expect(bad).toEqual([]);
  });

  it('a szöveg nem üres, legfeljebb 320 karakter, és nincs benne gondolatjel', () => {
    const bad = entries.filter(([, text]) => typeof text !== 'string' || text.trim() === '' || text.length > 320 || /[–—]/.test(text));
    expect(bad.map(([id]) => id)).toEqual([]);
  });

  it('a magyarázatlan kártyán nincs note', () => {
    setPcicTarget('es');
    expect(findPcicItem('o1')?.note).toBeUndefined();
  });
});
