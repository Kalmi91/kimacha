import { missedHint } from '@/lib/games/chatFeedback';
import type { ChatChecklistItem, ChatNodeOption } from '@/lib/games/content';

const checklist: ChatChecklistItem[] = [
  {
    id: 'ask-price',
    hu: 'Kérdezz rá az árra',
    en: 'Ask about the price',
    why: { hu: 'Ár nélkül nem tudsz dönteni.', en: 'Without a price you cannot decide.' },
    source: { label: 'PROFECO' },
  },
];

const options: ChatNodeOption[] = [
  { es: '¿Cuánto cuesta?', checklist: 'ask-price', next: 'n2' },
  { es: 'Está bien.', next: 'n3' },
];

it('names the missed checklist line and its reason', () => {
  const hint = missedHint(options, 1, new Set(), checklist, 'es', 'hu');
  expect(hint).toEqual({ better: '¿Cuánto cuesta?', why: 'Ár nélkül nem tudsz dönteni.' });
});

it('stays silent when the good option was picked', () => {
  expect(missedHint(options, 0, new Set(), checklist, 'es', 'hu')).toBeNull();
});

it('stays silent once the checklist item is already achieved', () => {
  expect(missedHint(options, 1, new Set(['ask-price']), checklist, 'es', 'hu')).toBeNull();
});

it('stays silent when the node had no better option', () => {
  const flat: ChatNodeOption[] = [{ es: 'Sí.', next: 'n2' }, { es: 'No.', next: 'n3' }];
  expect(missedHint(flat, 0, new Set(), checklist, 'es', 'hu')).toBeNull();
});

it('falls back to a `good` option when no checklist item is attached', () => {
  const withGood: ChatNodeOption[] = [
    { es: 'Buenos días, señor.', good: true, next: 'n2' },
    { es: 'Oye.', next: 'n3' },
  ];
  expect(missedHint(withGood, 1, new Set(), checklist, 'es', 'hu')).toEqual({
    better: 'Buenos días, señor.',
    why: '',
  });
});

it('an option marked good counts as a good pick', () => {
  const withGood: ChatNodeOption[] = [
    { es: 'Buenos días, señor.', good: true, next: 'n2' },
    { es: '¿Cuánto cuesta?', checklist: 'ask-price', next: 'n3' },
  ];
  expect(missedHint(withGood, 0, new Set(), checklist, 'es', 'hu')).toBeNull();
});

it('falls back to the English reason when the content language has none', () => {
  const hint = missedHint(options, 1, new Set(), checklist, 'es', 'de');
  expect(hint?.why).toBe('Without a price you cannot decide.');
});

it('falls back to another language for the option text', () => {
  const huOnly: ChatNodeOption[] = [
    { hu: 'Mennyibe kerül?', checklist: 'ask-price', next: 'n2' },
    { hu: 'Rendben.', next: 'n3' },
  ];
  expect(missedHint(huOnly, 1, new Set(), checklist, 'es', 'hu')?.better).toBe('Mennyibe kerül?');
});
