// The why-item give-away rule of scripts/audit-games.mjs (P1): see scripts/whyGiveaway.cjs.
const { whyGiveaways, containsTarget } = require('../../scripts/whyGiveaway.cjs');

const opt = (en: string, es: string = en) => ({ text: { en, es } });

describe('whyGiveaways', () => {
  it('flags a parenthesis in any option, in any language', () => {
    const item = {
      target: 'cuál',
      correctIndex: 0,
      options: [opt('asking to pick from a known set'), opt('asking for a definition'), opt('asking a quantity', 'pidiendo una cantidad (cuánto)')],
    };
    const issues = whyGiveaways(item);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('option 2 text.es');
  });

  it('flags the target in the right option when not every option has it', () => {
    const item = {
      target: 'mucho',
      correctIndex: 2,
      options: [opt('muy + adjective'), opt('mucho + noun'), opt('verb + mucho')],
    };
    expect(whyGiveaways(item).join(' ')).toContain('contains the target');
  });

  it('flags a form of the target (accent and case ignored)', () => {
    const item = {
      target: 'hablaba',
      correctIndex: 0,
      options: [opt('Hablaba is a habit'), opt('a single finished event'), opt('a command')],
    };
    expect(whyGiveaways(item)).toHaveLength(1);
  });

  it('accepts the target when every option has it, or when only a wrong option has it', () => {
    const everyOption = {
      target: 'cuál',
      correctIndex: 1,
      options: [opt('qué vs cuál'), opt('cuál picks from a set'), opt('cuál is never plural')],
    };
    expect(whyGiveaways(everyOption)).toEqual([]);
    const wrongOnly = {
      target: 'cuál',
      correctIndex: 0,
      options: [opt('asking to pick from a known set'), opt('cuál asks for a definition'), opt('asking a quantity')],
    };
    expect(whyGiveaways(wrongOnly)).toEqual([]);
  });

  it('passes a clean item and ignores an item without a target', () => {
    const clean = { target: 'a', correctIndex: 0, options: [opt('a job takes an article'), opt('the only one, so the'), opt('general sense, no article')] };
    expect(whyGiveaways(clean)).toHaveLength(1);
    const cleanOk = { target: 'doctor', correctIndex: 0, options: [opt('a job takes an article'), opt('the only one, so the'), opt('general sense, no article')] };
    expect(whyGiveaways(cleanOk)).toEqual([]);
    expect(whyGiveaways({ correctIndex: 0, options: [opt('x'), opt('y'), opt('z')] })).toEqual([]);
    expect(whyGiveaways({})).toEqual([]);
  });
});

describe('containsTarget', () => {
  it('matches whole words and multi-word targets, not substrings', () => {
    expect(containsTarget('uses es here', 'es')).toBe(true);
    expect(containsTarget('un profesor', 'es')).toBe(false);
    expect(containsTarget('me lo da', 'me lo')).toBe(true);
    expect(containsTarget('lo me da', 'me lo')).toBe(false);
    expect(containsTarget('anything', '')).toBe(false);
  });
});
