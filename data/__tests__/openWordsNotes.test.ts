// a data/words-open/notes.json (i) magyarázatai: minden kulcs egy
// létező `o<order>` kártya, a szöveg angol, rövid, és a Learn-kártya hozzáfér (PcicItem.note).
import notes from '../words-open/notes.json';
import { findPcicItem, setPcicTarget } from '../pcic';

describe('data/words-open/notes.json (i) explanations', () => {
  afterEach(() => setPcicTarget('es'));

  const entries = Object.entries(notes as Record<string, string>);

  it('there is at least one explanation', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every key is an existing o<order> card, and PcicItem.note brings the text', () => {
    setPcicTarget('es');
    const bad: string[] = [];
    for (const [id, text] of entries) {
      const item = /^o\d+$/.test(id) ? findPcicItem(id) : undefined;
      if (!item) bad.push(`${id}: nincs ilyen kártya`);
      else if (item.note !== text) bad.push(`${id}: a kártya note-ja nem egyezik`);
    }
    expect(bad).toEqual([]);
  });

  it('the text is not empty, at most 320 characters, and has no dash', () => {
    const bad = entries.filter(([, text]) => typeof text !== 'string' || text.trim() === '' || text.length > 320 || /[–—]/.test(text));
    expect(bad.map(([id]) => id)).toEqual([]);
  });

  it('a card without an explanation has no note', () => {
    setPcicTarget('es');
    expect(findPcicItem('o1')?.note).toBeUndefined();
  });
});
