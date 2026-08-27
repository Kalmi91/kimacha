import { availableOptions, findNode, pickEnding } from '../chat';
import type { ChatData, ChatNode } from '../content';

function node(over: Partial<ChatNode>): ChatNode {
  return { id: 'n1', npc: { es: 'Hola.' }, options: [], ...over };
}

function chat(over: Partial<ChatData>): ChatData {
  return {
    id: 'x',
    level: 'A2',
    title: { es: 'X' },
    setup: [],
    nodes: [],
    checklist: [],
    endings: [],
    ...over,
  };
}

describe('availableOptions', () => {
  it('offers options with no requires unconditionally', () => {
    const n = node({ options: [{ es: 'a', next: 'n2' }] });
    expect(availableOptions(n, {})).toHaveLength(1);
  });

  it('filters out options whose requires do not match the context', () => {
    const n = node({
      options: [
        { es: 'poco dinero', next: 'n2', requires: { budget: 'low' } },
        { es: 'mucho dinero', next: 'n3', requires: { budget: 'high' } },
      ],
    });
    expect(availableOptions(n, { budget: 'low' }).map((o) => o.es)).toEqual(['poco dinero']);
    expect(availableOptions(n, { budget: 'high' }).map((o) => o.es)).toEqual(['mucho dinero']);
  });

  it('requires ALL entries to match, not just one', () => {
    const n = node({
      options: [{ es: 'a', next: 'n2', requires: { budget: 'low', goal: 'city' } }],
    });
    expect(availableOptions(n, { budget: 'low' })).toHaveLength(0);
    expect(availableOptions(n, { budget: 'low', goal: 'city' })).toHaveLength(1);
  });
});

describe('findNode', () => {
  it('finds a node by id', () => {
    const c = chat({ nodes: [node({ id: 'a' }), node({ id: 'b' })] });
    expect(findNode(c, 'b')?.id).toBe('b');
    expect(findNode(c, 'zzz')).toBeUndefined();
  });
});

describe('pickEnding', () => {
  const endings = [
    { id: 'great', if: 'checklist>=6', title: { hu: 'Nagyszerű' } },
    { id: 'ok', if: 'checklist>=3', title: { hu: 'Rendben' } },
    { id: 'bad', if: 'default', title: { hu: 'Gyenge' } },
  ];

  it('picks the first matching threshold in authored order', () => {
    const c = chat({ endings });
    expect(pickEnding(c, 7)?.id).toBe('great');
    expect(pickEnding(c, 6)?.id).toBe('great');
    expect(pickEnding(c, 5)?.id).toBe('ok');
    expect(pickEnding(c, 3)?.id).toBe('ok');
  });

  it('falls back to the default ending when no threshold matches', () => {
    const c = chat({ endings });
    expect(pickEnding(c, 0)?.id).toBe('bad');
  });

  it('falls back to the last ending when there is no default and nothing matches', () => {
    const c = chat({ endings: [{ id: 'only', if: 'checklist>=10', title: { hu: 'X' } }] });
    expect(pickEnding(c, 0)?.id).toBe('only');
  });

  it('returns undefined for a chat with zero endings', () => {
    expect(pickEnding(chat({ endings: [] }), 5)).toBeUndefined();
  });
});
