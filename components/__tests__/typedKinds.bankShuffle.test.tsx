// FB706: the word bank must not show the right word first (the data lists it first in most items).

import * as fs from 'fs';
import * as path from 'path';
import { render, screen } from '@testing-library/react-native';

import { BankDrillItem, bankDisplayOrder } from '../grammar/TypedKinds';
import type { BankItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

const L = (en: string) => ({ en, es: en });
const BANK: BankItem = {
  kind: 'bank',
  id: 'b1',
  bank: ['alto', 'rojo', 'simpático'],
  es: 'Las chicas son ___ .',
  word: 'alto',
  answer: 'altas',
  tr: L('The girls are tall.'),
  why: L('the adjective agrees with chicas'),
};

function collectBankItems(node: unknown, out: BankItem[]): void {
  if (Array.isArray(node)) node.forEach((n) => collectBankItems(n, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (o.kind === 'bank' && Array.isArray(o.bank) && typeof o.word === 'string') out.push(o as unknown as BankItem);
    else Object.values(o).forEach((v) => collectBankItems(v, out));
  }
}

function shownWords(): string[] {
  return screen.getAllByTestId(/^bank-word-\d+$/).map((n) => {
    const text = n.findAll((c) => typeof c.props.children === 'string');
    return text[0].props.children as string;
  });
}

describe('word bank order', () => {
  it('shows every word, mixed, the same on every render', () => {
    const props = { learnedLang: 'es', contentLang: 'en', strictAccents: true, onDone: jest.fn() } as const;
    const first = render(<BankDrillItem item={BANK} {...props} />);
    const a = shownWords();
    first.unmount();
    render(<BankDrillItem item={BANK} {...props} />);
    const b = shownWords();
    expect([...a].sort()).toEqual([...BANK.bank].sort());
    expect(a).toEqual(b);
    expect(a).toEqual(bankDisplayOrder(BANK));
  });

  it('the right word is first in less than 60% of all authored bank items', () => {
    const dir = path.join(__dirname, '..', '..', 'data', 'games', 'grammar', 'es');
    const items: BankItem[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      collectBankItems(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), items);
    }
    expect(items.length).toBeGreaterThan(200);
    const before = items.filter((i) => i.bank[0] === i.word).length / items.length;
    const afterShuffle = items.filter((i) => bankDisplayOrder(i)[0] === i.word).length / items.length;
    console.log(`bank items ${items.length}, right word first before ${(before * 100).toFixed(1)}%, after ${(afterShuffle * 100).toFixed(1)}%`);
    expect(afterShuffle).toBeLessThan(0.6);
  });
});
