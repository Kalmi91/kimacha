// The made-up players of the weekly leaderboard (components/board/): a fixed cast whose XP is computed from the clock, so the board
// is never empty and moves while the screen is open. Pure and deterministic: the same week + name + time always gives the same XP
// (no Math.random, nothing stored), so every device and every refresh agrees. The server knows nothing about them.
import type { BoardData, BoardRow } from './board';
import { BOARD_LIST_MAX, weekDayOffset } from './boardStats';
import { nameKey } from './validate';

export interface Bot {
  name: string;
  // the XP the bot earns in a typical week; each week scatters it by 0.8..1.2
  weekly: number;
}

// A learner who earns 50 XP a day (350 a week) ends the week in the middle of this field.
// The cast is this big so the board moves often: together they earn about one XP a minute during the day.
export const BOTS: readonly Bot[] = [
  { name: 'Ricky07', weekly: 760 },
  { name: 'LaPatrona', weekly: 700 },
  { name: 'TacoLover', weekly: 640 },
  { name: 'SzofiHU', weekly: 610 },
  { name: 'kamarano', weekly: 590 },
  { name: 'Diego', weekly: 520 },
  { name: 'Dani_mx', weekly: 480 },
  { name: 'xX_Nacho_Xx', weekly: 450 },
  { name: 'pixelmano', weekly: 430 },
  { name: 'Luis', weekly: 400 },
  { name: 'ToroLoco', weekly: 380 },
  { name: 'NyelvNinja', weekly: 370 },
  { name: 'Panni_22', weekly: 320 },
  { name: 'ElCrack77', weekly: 300 },
  { name: 'Gabo.mx', weekly: 270 },
  { name: 'chilango_23', weekly: 240 },
  { name: 'quesadilla9', weekly: 210 },
  { name: 'GatoLoco', weekly: 180 },
  { name: 'BogyoBoy', weekly: 160 },
  { name: 'Zsolti92', weekly: 130 },
  { name: 'NoSleepMx', weekly: 110 },
  { name: 'vale.mx', weekly: 90 },
  { name: 'darkPaco', weekly: 60 },
  { name: 'lolka_07', weekly: 25 },
];

export { BOARD_LIST_MAX };

const REST_CHANCE = 0.15;
const DAY_MINUTES = 24 * 60;
const ACTIVE_FROM = 7 * 60;
const ACTIVE_TO = 23 * 60;
const STEADY_SHARE = 0.6;

// FNV-1a: a text to a 32-bit number
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: the seed to a sequence of numbers in [0, 1)
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Session {
  start: number;
  end: number;
  // this session's part of the day's XP (the parts of a day add up to 1)
  share: number;
}

interface DayPlan {
  xp: number;
  sessions: Session[];
}

// The bot's whole week: per day the XP and the 4-8 sessions it is earned in.
function planWeek(bot: Bot, weekStart: string): DayPlan[] {
  const rng = mulberry32(fnv1a(`${weekStart}|${bot.name}|plan`));
  const target = bot.weekly * (0.8 + 0.4 * rng());
  const weights: number[] = Array.from({ length: 7 }, () => {
    const weight = 0.4 + 1.2 * rng();
    return rng() < REST_CHANCE ? 0 : weight;
  });
  if (!weights.some((w) => w > 0)) weights[0] = 1;
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => {
    const count = 4 + Math.floor(rng() * 5);
    const raw = Array.from({ length: count }, (_, i) => {
      // One session in each equal slot of 7:00 to 23:00, 20 to 50 minutes long: the latest end is 23:50, always before 23:59. Spread
      // like this, somebody on the board is earning XP at any time of the day.
      const start = ACTIVE_FROM + Math.floor(((i + rng()) * (ACTIVE_TO - ACTIVE_FROM)) / count);
      return { start, end: start + 20 + Math.floor(rng() * 31), weight: 0.5 + rng() };
    });
    const parts = raw.reduce((a, s) => a + s.weight, 0);
    return { xp: (target * w) / sum, sessions: raw.map((s) => ({ start: s.start, end: s.end, share: s.weight / parts })) };
  });
}

// A plan depends only on its week and bot, so it never goes stale; the board asks for all of them every few seconds.
const plans = new Map<string, DayPlan[]>();
function planFor(bot: Bot, weekStart: string): DayPlan[] {
  const key = `${weekStart}|${bot.name}`;
  let plan = plans.get(key);
  if (!plan) {
    if (plans.size >= 2 * BOTS.length) plans.clear();
    plan = planWeek(bot, weekStart);
    plans.set(key, plan);
  }
  return plan;
}

// The XP the bot earns on each day of the week starting `weekStart` (fractional; botXpAt floors the running total).
export function botDailyXp(bot: Bot, weekStart: string): number[] {
  return planFor(bot, weekStart).map((d) => d.xp);
}

// The bot's XP so far this week, a whole number that never goes down: the earlier days in full plus today's part up to
// `minuteOfDay`. STEADY_SHARE of a day's XP comes evenly from ACTIVE_FROM to ACTIVE_TO, which keeps the board moving all day; the
// rest comes in the day's sessions, each growing linearly while it runs, which makes the players look like they sit down to learn.
export function botXpAt(bot: Bot, weekStart: string, dayIndex: number, minuteOfDay: number): number {
  const plan = planFor(bot, weekStart);
  const day = Math.min(6, Math.max(0, dayIndex));
  const minute = Math.min(DAY_MINUTES - 1, Math.max(0, minuteOfDay));
  let total = 0;
  for (let i = 0; i < day; i++) total += plan[i].xp;
  const done = minute >= ACTIVE_TO && plan[day].sessions.every((s) => minute >= s.end);
  const steady = Math.min(1, Math.max(0, (minute - ACTIVE_FROM) / (ACTIVE_TO - ACTIVE_FROM)));
  const part = plan[day].sessions.reduce((a, s) => a + s.share * Math.min(1, Math.max(0, (minute - s.start) / (s.end - s.start))), 0);
  return Math.floor(total + plan[day].xp * (done ? 1 : Math.min(1, STEADY_SHARE * steady + (1 - STEADY_SHARE) * part)));
}

// The board order of the server (cloud/logic.ts rankBoard): XP descending, then the name with case and accents ignored.
const byXpThenName = (a: { xp: number; name: string }, b: { xp: number; name: string }) =>
  b.xp - a.xp || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// The server's board with the made-up players mixed in at the clock's time `now`: ranks and the 50-row cut are redone, `me.rank`
// counts the bots ahead of the caller (even when the caller is below the cut). A bot whose name matches a real player (or the
// caller) is left out, and so is one with 0 XP, like a real player on the server.
export function withBots(data: BoardData, now: Date = new Date()): BoardData {
  // Past Sunday (a stale week) the bots stand at the week's end, before Monday at its start: their XP never drops in between.
  const offset = weekDayOffset(data.weekStart, now);
  const dayIndex = Number.isFinite(offset) ? Math.min(6, Math.max(0, offset)) : 0;
  const minute = offset > 6 ? DAY_MINUTES - 1 : offset >= 0 ? now.getHours() * 60 + now.getMinutes() : 0;
  const taken = new Set(data.rows.map((r) => nameKey(r.name)));
  if (data.me) taken.add(nameKey(data.me.name));
  const bots = BOTS.filter((b) => !taken.has(nameKey(b.name)))
    .map((b) => ({ name: b.name, xp: botXpAt(b, data.weekStart, dayIndex, minute), me: false }))
    .filter((b) => b.xp > 0);
  const rows: BoardRow[] = [...data.rows, ...bots]
    .sort((a, b) => byXpThenName(a, b))
    .slice(0, BOARD_LIST_MAX)
    .map((r, i) => ({ rank: i + 1, name: r.name, xp: r.xp, me: r.me }));
  const me = data.me;
  return { ...data, rows, me: me && { ...me, rank: me.rank + bots.filter((b) => byXpThenName(b, me) < 0).length } };
}
