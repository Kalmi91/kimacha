// GAMES.md 4.6 (F4, chat): pure helpers for the advisor-chat screen, same
// split-logic-from-screen shape as story.ts/myth.ts.
//
// F4 MEGVALÓSÍTÁSI JEGYZET: `nodes[0]` is always the entry point (see
// content.ts's ChatNodeOption comment for why: a `requires` gate on options,
// not per-setup-combo node subtrees, is what makes "más kimenetele legyen ha
// mást mondasz" (K24) actually happen). `pickEnding` reads `chat.endings` in
// AUTHORED ORDER and returns the first one whose `if` matches the achieved
// checklist count, so content authors list endings best-to-worst
// (`checklist>=6` before `checklist>=3`), falling back to an explicit
// `"default"` ending, or the last authored ending if nothing else matches
// (never returns undefined for a chat that has at least one ending, which
// the audit's P1 "needs >=1 ending" check guarantees for shipped content).

import type { ChatData, ChatNode, ChatNodeOption, ChatEnding } from './content';

/** Options at `node` that this setup context unlocks (no `requires` = always offered). */
export function availableOptions(node: ChatNode, context: Record<string, string>): ChatNodeOption[] {
  return node.options.filter((opt) => {
    if (!opt.requires) return true;
    return Object.entries(opt.requires).every(([k, v]) => context[k] === v);
  });
}

export function findNode(chat: ChatData, id: string): ChatNode | undefined {
  return chat.nodes.find((n) => n.id === id);
}

type CmpOp = '>=' | '<=' | '>' | '<' | '==';
type Condition = { type: 'default' } | { type: 'cmp'; op: CmpOp; n: number };

function parseCondition(raw: string | undefined): Condition {
  if (raw === 'default' || !raw) return { type: 'default' };
  const m = /^checklist(>=|<=|>|<|==)(\d+)$/.exec(raw);
  if (!m) return { type: 'default' };
  return { type: 'cmp', op: m[1] as CmpOp, n: Number(m[2]) };
}

function evalCondition(cond: Condition, count: number): boolean {
  if (cond.type !== 'cmp') return false;
  switch (cond.op) {
    case '>=':
      return count >= cond.n;
    case '<=':
      return count <= cond.n;
    case '>':
      return count > cond.n;
    case '<':
      return count < cond.n;
    case '==':
      return count === cond.n;
    default:
      return false;
  }
}

export function pickEnding(chat: ChatData, checklistCount: number): ChatEnding | undefined {
  const endings = chat.endings ?? [];
  for (const e of endings) {
    const cond = parseCondition(e.if);
    if (cond.type === 'cmp' && evalCondition(cond, checklistCount)) return e;
  }
  const fallback = endings.find((e) => parseCondition(e.if).type === 'default');
  return fallback ?? endings[endings.length - 1];
}
