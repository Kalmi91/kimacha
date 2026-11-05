import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { boardToken, getBoard, joinBoard, leaveBoard, rejoinBoard, type BoardData, type BoardFailure, type BoardMetric } from '@/lib/cloud/board';
import { withBots } from '@/lib/cloud/boardBots';
import { pushBoardNow } from '@/lib/cloud/boardSync';
import { shiftDate, timeView, weekDayIndex } from '@/lib/cloud/boardStats';
import { loadSession } from '@/lib/cloud/session';
import { isValidName } from '@/lib/cloud/validate';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { localDateString } from '@/lib/usageStats';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { useReduceMotion } from './boardUi';
import type { Gains } from './Podium';

// While the tab is focused and the app is active the board is read again this often...
export const BOARD_REFRESH_MS = 30000;
// ...and the made-up players, who move with the clock and need no network, are moved on this often.
export const BOARD_TICK_MS = 10000;

// Where the switch's choice is kept (lib/resumeStore.ts: the DB on native, localStorage on web), so it survives leaving the tab and an app kill.
const METRIC_KEY = 'board-metric';

export type Phase = 'loading' | 'join' | 'ready' | 'left' | 'offline' | 'hidden';

// What the own-week panel needs from the local database: XP per day of the week (null = still to come), last week's sum, the streak.
export interface WeekData {
  // the server's week these figures belong to
  weekStart: string;
  days: (number | null)[];
  lastWeek: number;
  // the same for the learning minutes (the time ranking)
  minutes: (number | null)[];
  lastWeekMinutes: number;
  streak: number;
}

function joinError(failure: BoardFailure): string {
  const s = t().board;
  switch (failure.error) {
    case 'name_taken':
      return s.nameTaken;
    case 'bad_input':
      return s.badName;
    case 'locked':
      return s.tooManyJoins;
    default:
      return s.offline;
  }
}

async function loadWeek(weekStart: string): Promise<WeekData> {
  const db = getDb();
  const todayIndex = weekDayIndex(weekStart, new Date());
  const days = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => (i <= todayIndex ? (await db.getDailyXpTenths(shiftDate(weekStart, i))) / 10 : null)),
  );
  const before = await Promise.all(Array.from({ length: 7 }, (_, i) => db.getDailyXpTenths(shiftDate(weekStart, i - 7))));
  const usage = new Map((await db.getUsageStats()).last30Days.map((d): [string, number] => [d.date, d.minutes]));
  const minutes = Array.from({ length: 7 }, (_, i) => (i <= todayIndex ? usage.get(shiftDate(weekStart, i)) ?? 0 : null));
  const lastWeekMinutes = Array.from({ length: 7 }, (_, i) => usage.get(shiftDate(weekStart, i - 7)) ?? 0).reduce((a, b) => a + b, 0);
  return { weekStart, days, lastWeek: Math.round(before.reduce((a, b) => a + b, 0) / 10), minutes, lastWeekMinutes, streak: (await db.getStreak())?.current_count ?? 0 };
}

// The state and the actions of the weekly leaderboard screen: the phases (loading / join / ready / left / offline / hidden), joining,
// leaving, the quiet refresh every BOARD_REFRESH_MS, and the "+N" gains between two refreshes. The server's answer is kept as it
// came (`raw`); the made-up players are mixed in from it on every refresh with the current time.
export function useBoard() {
  // A guest on web has no board at all, so it never shows even for a moment.
  const [phase, setPhase] = useState<Phase>(() => (Platform.OS === 'web' && !loadSession() ? 'hidden' : 'loading'));
  const [data, setData] = useState<BoardData | null>(null);
  const [week, setWeek] = useState<WeekData | null>(null);
  const [gains, setGains] = useState<Gains>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The switch: what the learner chose (kept), and whether the worker can rank by time at all (an old worker answers by XP: the switch hides).
  const [choice, setChoice] = useState<BoardMetric>('xp');
  const [timeSupported, setTimeSupported] = useState(true);
  const chosen = useRef<BoardMetric | null>(null);
  const prevMetric = useRef<BoardMetric>('xp');
  const reduceMotion = useReduceMotion();
  const reduceRef = useRef(reduceMotion);
  const raw = useRef<BoardData | null>(null);
  const prevXp = useRef<Map<string, number> | null>(null);
  const gainId = useRef(0);
  // Bumped by every load, join, rejoin and leave: an answer that belongs to an older generation is dropped.
  const generation = useRef(0);
  const weekFor = useRef<string | null>(null);

  // Mixes the bots into the last server answer for the current time. Names whose XP grew since the previous call get a "+N"
  // (the previous values are reset by every load, so only the quiet refreshes while the screen stays open show them); a "+N" whose
  // row has left the list is dropped.
  const show = useCallback(() => {
    if (!raw.current) return;
    const ranked = withBots(raw.current, new Date());
    // in the time ranking every row's `xp` is its minutes (timeView), so the pieces below read one number for both rankings
    const next = ranked.metric === 'time' ? timeView(ranked) : ranked;
    const prev = prevMetric.current === (next.metric ?? 'xp') ? prevXp.current : null;
    prevMetric.current = next.metric ?? 'xp';
    const grown: Gains = {};
    if (prev && !reduceRef.current) {
      for (const r of next.rows) {
        const before = prev.get(r.name);
        if (before !== undefined && r.xp > before) grown[r.name] = { delta: r.xp - before, id: ++gainId.current };
      }
    }
    const names = new Set(next.rows.map((r) => r.name));
    setGains((g) => {
      const merged = { ...g, ...grown };
      for (const n of Object.keys(merged)) if (!names.has(n)) delete merged[n];
      return merged;
    });
    prevXp.current = new Map(next.rows.map((r) => [r.name, r.xp]));
    setData(next);
  }, []);

  const forget = useCallback(() => {
    raw.current = null;
    prevXp.current = null;
    weekFor.current = null;
    setData(null);
    setWeek(null);
    setGains({});
  }, []);

  // The own-week figures; a database failure leaves the board without the panel instead of leaving the screen loading.
  const refreshWeek = useCallback(async (weekStart: string) => {
    try {
      const w = await loadWeek(weekStart);
      weekFor.current = weekStart;
      return w;
    } catch {
      weekFor.current = null;
      return null;
    }
  }, []);

  // The server forgot this device (native): back to the join form.
  const dropIdentity = useCallback(async () => {
    await getDb().setBoardIdentity(null);
    forget();
    setPhase('join');
  }, [forget]);

  // The ranking the learner chose, read from the store once (a failed read is XP, the default).
  const askedMetric = useCallback(async (): Promise<BoardMetric> => {
    if (chosen.current === null) {
      const saved = await loadResumeValue(getDb(), METRIC_KEY);
      if (chosen.current === null) {
        chosen.current = saved === 'time' ? 'time' : 'xp';
        setChoice(chosen.current);
      }
    }
    return chosen.current;
  }, []);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    const stale = () => mine !== generation.current;
    const token = await boardToken();
    if (stale()) return;
    if (!token) {
      setPhase(Platform.OS === 'web' ? 'hidden' : 'join');
      return;
    }
    await pushBoardNow();
    const asked = await askedMetric();
    const res = await getBoard(token, localDateString(), asked);
    // an answer for the other ranking (the learner switched meanwhile) is dropped: the switch fetches its own
    if (stale() || asked !== chosen.current) return;
    if (res.ok) {
      if (asked === 'time') setTimeSupported(res.data.metric === 'time');
      raw.current = res.data;
      prevXp.current = null;
      setGains({});
      show();
      const w = await refreshWeek(res.data.weekStart);
      if (stale()) return;
      setWeek(w);
      setPhase(res.data.me && !res.data.left ? 'ready' : 'left');
    } else if (res.error === 'bad_token' && Platform.OS !== 'web') {
      await dropIdentity();
    } else {
      setPhase('offline');
    }
  }, [show, refreshWeek, dropIdentity, askedMetric]);

  // A failed refresh keeps the last server answer and only moves the bots on; it never turns the screen "offline".
  const refresh = useCallback(async () => {
    const mine = generation.current;
    const token = await boardToken();
    if (!token || mine !== generation.current) return;
    const asked = await askedMetric();
    const res = await getBoard(token, localDateString(), asked);
    if (mine !== generation.current || asked !== chosen.current) return;
    if (res.ok) {
      if (asked === 'time') setTimeSupported(res.data.metric === 'time');
      raw.current = res.data;
      setPhase(res.data.me && !res.data.left ? 'ready' : 'left');
      // the figures are missing (the first load had no database) or belong to another week (Sunday to Monday)
      if (weekFor.current !== res.data.weekStart) {
        const w = await refreshWeek(res.data.weekStart);
        if (mine !== generation.current) return;
        setWeek(w);
      }
    } else if (res.error === 'bad_token' && Platform.OS !== 'web') {
      await dropIdentity();
      return;
    }
    show();
  }, [show, refreshWeek, dropIdentity, askedMetric]);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    reduceRef.current = reduceMotion;
    refreshRef.current = refresh;
  });

  // After the first load the screen refreshes quietly: no loading state over a form or a list that is already there.
  useScreenLoad(load, { hasData: phase !== 'loading' });

  // The timer runs only while the tab is focused and the app is active.
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      let tick: ReturnType<typeof setInterval> | null = null;
      const stop = () => {
        if (timer) clearInterval(timer);
        if (tick) clearInterval(tick);
        timer = null;
        tick = null;
      };
      const start = () => {
        stop();
        timer = setInterval(() => void refreshRef.current(), BOARD_REFRESH_MS);
        tick = setInterval(show, BOARD_TICK_MS);
      };
      // the state can still be unknown (null) right after launch: that counts as active
      if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') start();
      const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
      return () => {
        stop();
        sub.remove();
      };
    }, [show]),
  );

  // The switch: the choice is remembered at once, and the board of that ranking is asked for (the list keeps showing the other one until it arrives).
  const switchMetric = useCallback((metric: BoardMetric) => {
    if (metric === chosen.current) return;
    chosen.current = metric;
    setChoice(metric);
    void saveResumeValue(getDb(), METRIC_KEY, metric);
    void refreshRef.current();
  }, []);

  const gainDone = useCallback((who: string, id: number) => {
    setGains((g) => {
      if (g[who]?.id !== id) return g;
      const { [who]: _done, ...rest } = g;
      return rest;
    });
  }, []);

  const join = async () => {
    if (busy || !isValidName(name)) return;
    generation.current++;
    setBusy(true);
    setError(null);
    const res = await joinBoard(name);
    if (!res.ok) {
      setBusy(false);
      setError(joinError(res));
      return;
    }
    try {
      await getDb().setBoardIdentity({ token: res.data.token, name: res.data.displayName });
    } catch {
      setBusy(false);
      setError(t().board.offline);
      return;
    }
    setBusy(false);
    setPhase('loading');
    await load();
  };

  // Web: an account that left joins again under its account name (no name to enter).
  const rejoin = async () => {
    if (busy) return;
    generation.current++;
    setBusy(true);
    setError(null);
    const token = await boardToken();
    const res = token ? await rejoinBoard(token) : null;
    setBusy(false);
    if (res?.ok) {
      setPhase('loading');
      await load();
    } else {
      setError(res ? joinError(res) : t().board.offline);
    }
  };

  const doLeave = async () => {
    generation.current++;
    const token = await boardToken();
    if (token) {
      const res = await leaveBoard(token);
      // A failed delete keeps the identity: without the token the name could never be removed again.
      if (!res.ok && res.error !== 'bad_token') {
        setError(t().board.offline);
        return;
      }
    }
    setError(null);
    if (Platform.OS === 'web') {
      // the server now answers "left" and keeps the list; a web account has no identity of its own to drop
      setPhase('loading');
      await load();
      return;
    }
    await getDb().setBoardIdentity(null);
    generation.current++;
    forget();
    setName('');
    setPhase('join');
  };

  const confirmLeave = () => {
    const s = t().board;
    if (Platform.OS === 'web') {
      if (window.confirm(`${s.leave}\n${s.leaveConfirm}`)) void doLeave();
    } else {
      Alert.alert(s.leave, s.leaveConfirm, [
        { text: t().feedback.cancel, style: 'cancel' },
        { text: s.leaveYes, style: 'destructive', onPress: () => void doLeave() },
      ]);
    }
  };

  const changeName = (v: string) => {
    setName(v);
    setError(null);
  };

  // `shown`: the ranking `data` is in (the worker's answer decides, so an old worker always shows XP)
  const shown: BoardMetric = data?.metric === 'time' ? 'time' : 'xp';
  return { phase, data, week, gains, gainDone, choice, shown, timeSupported, switchMetric, name, changeName, busy, error, join, rejoin, confirmLeave, reduceMotion };
}
