// E144 point 1: the sidecar overlay reaches the texts of the four new kinds (ask, why, explain, tr), so a Hungarian
// text shows whenever the sidecar has the English key; an English text means the key is missing in the sidecar.

import { lang4Keys, withOverlay } from '@/lib/grammar/overlay';

const L = (en: string) => ({ en, es: en });
const lesson = {
  items: [
    { kind: 'noun', id: 'n', base: 'la ciudad', ask: L('Give the plural, with its article'), answer: 'las ciudades', why: L('Why noun') },
    { kind: 'opencloze', id: 'c', text: 'a ___', answers: ['b'], tr: L('Tr cloze'), why: L('Why cloze') },
    { kind: 'fix', id: 'f', es: 'a b', wrongIndex: 1, answer: 'c', explain: L('Explain fix'), tr: L('Tr fix') },
    { kind: 'bank', id: 'b', bank: ['x'], es: 'a ___', word: 'x', answer: 'y', tr: L('Tr bank'), why: L('Why bank') },
  ],
};

it('every text of the new kinds is an overlay key, and a sidecar entry turns it into hu', () => {
  const keys = lang4Keys(lesson);
  expect(keys).toEqual(expect.arrayContaining(['Give the plural, with its article', 'Why noun', 'Tr cloze', 'Why cloze', 'Explain fix', 'Tr fix', 'Tr bank', 'Why bank']));
  const out: any = withOverlay(lesson, 'hu', { 'Give the plural, with its article': 'Add meg a többes számot', 'Explain fix': 'Magyarázat', 'Why bank': 'Miért' });
  expect(out.items[0].ask.hu).toBe('Add meg a többes számot');
  expect(out.items[2].explain.hu).toBe('Magyarázat');
  expect(out.items[3].why.hu).toBe('Miért');
  expect(out.items[0].why.hu).toBeUndefined(); // no sidecar entry: stays English through `?? en`
});
