import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, runOnJS, Easing } from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { findWordById, genderOf, normalizeWordToken, type Level } from '@/data/words';
import { getTopicsForLevel, getTopicName } from '@/data/topics';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool } from '@/lib/games/vocabPool';
import { bubbleSlot, BUBBLE_SIZE, BUBBLE_GAP, buildBubbleRound, type BubbleCategorySet, type BubbleItem, type BubbleWordMeta } from '@/lib/games/bubblePop';
import { hashString } from '@/lib/shuffle';
import { useGameSession } from '@/lib/games/session';
import { comboMultiplier, getGameBest, recordGameResult } from '@/lib/games/scoring';
import GameShell from '@/components/games/GameShell';
import GameOverCard from '@/components/games/GameOverCard';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';
import type { GlossInfo } from '@/lib/games/gloss';

// GAMES.md 4.2 (F2, bubble-pop). K7 DÖNTÉS: no hard time limit by default,
// bubbles rise slowly and pop harmlessly at the top; a good bubble lost that
// way is a missed hit, not a life loss. 5 rounds per run.

type Speed = 'slow' | 'normal' | 'fast';
type TimeLimit = 'none' | '30' | '20';

const SPEED_MS: Record<Speed, number> = { slow: 12000, normal: 8000, fast: 5500 };
const BUBBLE_COUNTS = [8, 12, 16];
const TOTAL_ROUNDS = 5;
const START_LIVES = 5;

interface BubbleTileState extends BubbleItem {
  id: string;
  x: number;
  row: number; // FB162: grid row, the bubbles of row N start N rows below the board
}

function posLabel(pos: string, sPos: { posNoun: string; posVerb: string; posAdj: string; posAdv: string }): string {
  if (pos === 'noun') return sPos.posNoun;
  if (pos === 'verb') return sPos.posVerb;
  if (pos === 'adj') return sPos.posAdj;
  return sPos.posAdv;
}

function Bubble({
  bubble,
  durationMs,
  boardHeight,
  flashRed,
  onReachTop,
  onPop,
  onReveal,
  colors,
}: {
  bubble: BubbleTileState;
  durationMs: number;
  boardHeight: number;
  flashRed: boolean;
  onReachTop: (id: string) => void;
  onPop: (id: string) => void;
  onReveal: (id: string) => void;
  colors: { card: string; tint: string; text: string; tabIconDefault: string };
}) {
  const startY = boardHeight - 20 + bubble.row * (BUBBLE_SIZE + BUBBLE_GAP);
  const translateY = useSharedValue(startY);

  useEffect(() => {
    // FB162: a lower row has further to travel, so its duration grows with the
    // distance and every bubble drifts at the same speed.
    const duration = Math.round((durationMs * (startY + 50)) / (boardHeight + 30));
    translateY.value = withTiming(-50, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onReachTop)(bubble.id);
    });
    return () => cancelAnimation(translateY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[styles.bubbleWrap, { left: bubble.x }, style]}>
      <Pressable onPress={() => onPop(bubble.id)} onLongPress={() => onReveal(bubble.id)} delayLongPress={400}>
        <View
          style={[
            styles.bubbleCircle,
            { backgroundColor: flashRed ? '#EF4444' : colors.card, borderColor: colors.tint },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: colors.text },
              bubble.isNew ? { textDecorationLine: 'underline', textDecorationStyle: 'dotted', color: colors.tabIconDefault } : null,
            ]}
            numberOfLines={1}
          >
            {bubble.learned}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function BubblePopScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const gameDef = getGameDef('bubble-pop')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [bubbleCount, setBubbleCount] = useState(12);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [categorySet, setCategorySet] = useState<BubbleCategorySet>('topic');
  const [timeLimit, setTimeLimit] = useState<TimeLimit>('none');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [meta, setMeta] = useState<BubbleWordMeta[]>([]);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(0);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [bubbles, setBubbles] = useState<BubbleTileState[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<GlossInfo | null>(null);
  const [roundClock, setRoundClock] = useState<number | null>(null);
  const [gameOverEarly, setGameOverEarly] = useState(false);

  const session = useGameSession({ startLives: START_LIVES, onLivesDepleted: () => setBubbles([]) });
  const lastCategoryRef = useRef<string | undefined>(undefined);
  const roundKeyRef = useRef(0);
  const roundIndexRef = useRef(0); // 0-based, source of truth; `round` state mirrors it for display only
  const recordedRef = useRef(false);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const boardHeight = 420;
  const boardWidth = Math.min(windowWidth - 32, 380);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    const activePair = `${source}-${target}`;
    setLearnedLang(target);
    setContentLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');

    const levelData = await db.getLevel();
    setLevel(levelData.level as Level);

    const savedSettings = await db.getGameSettings('bubble-pop');
    const savedCount = (savedSettings?.bubbleCount as number) ?? 12;
    const savedSpeed = (savedSettings?.speed as Speed) ?? 'normal';
    const savedCategorySet = (savedSettings?.categorySet as BubbleCategorySet) ?? 'topic';
    const savedTimeLimit = (savedSettings?.timeLimit as TimeLimit) ?? 'none';
    setBubbleCount(BUBBLE_COUNTS.includes(savedCount) ? savedCount : 12);
    setSpeed(savedSpeed in SPEED_MS ? savedSpeed : 'normal');
    setCategorySet(['topic', 'pos', 'gender'].includes(savedCategorySet) ? savedCategorySet : 'topic');
    setTimeLimit(['none', '30', '20'].includes(savedTimeLimit) ? savedTimeLimit : 'none');

    const bestRow = await getGameBest('bubble-pop');
    setBest(bestRow?.bestScore ?? 0);

    const pool = await getLearnedPool({ pair: activePair, learnedLang: target, level: levelData.level as Level, minSize: 60 });
    const m: BubbleWordMeta[] = pool.map((e) => {
      const word = findWordById(e.wordId, target);
      return { wordId: e.wordId, learned: e.learned, native: e.native, isNew: e.isNew, topicId: e.topicId, pos: word?.pos, gender: genderOf(word, target) };
    });
    setMeta(m);

    lastCategoryRef.current = undefined;
    roundKeyRef.current = 0;
    roundIndexRef.current = 0;
    recordedRef.current = false;
    setRound(0);
    setGameOverEarly(false);
    session.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (next: { bubbleCount: number; speed: Speed; categorySet: BubbleCategorySet; timeLimit: TimeLimit }) => {
    getDb().setGameSettings('bubble-pop', next).catch(() => {});
  };

  const categoryDisplay = (set: BubbleCategorySet, value: string): string => {
    if (set === 'topic') {
      const topic = getTopicsForLevel(level, learnedLang).find((t2) => t2.id === value);
      return topic ? getTopicName(topic, contentLang) : value;
    }
    if (set === 'pos') return posLabel(value, s.games.bubblePop);
    if (value === 'm') return s.games.bubblePop.genderM;
    return value === 'n' ? s.games.bubblePop.genderN : s.games.bubblePop.genderF;
  };

  const startNextRound = useCallback(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setBubbles([]);
    setReveal(null);

    let built = null;
    for (let attempt = 0; attempt < 6 && !built; attempt++) {
      const seed = hashString(`${categorySet}:${roundKeyRef.current}:${attempt}`);
      built = buildBubbleRound(meta, categorySet, bubbleCount, seed, lastCategoryRef.current);
    }
    if (!built) {
      for (let attempt = 0; attempt < 4 && !built; attempt++) {
        const seed = hashString(`fallback:${roundKeyRef.current}:${attempt}`);
        built = buildBubbleRound(meta, 'topic', bubbleCount, seed);
      }
    }
    roundKeyRef.current += 1;

    if (!built) {
      setGameOverEarly(true);
      session.end();
      return;
    }

    lastCategoryRef.current = built.categoryValue;
    setCategoryLabel(categoryDisplay(built.categorySet, built.categoryValue));
    const items = built.items;
    setBubbles(
      items.map((item, i) => {
        const slot = bubbleSlot(i, boardWidth);
        return { ...item, id: `${roundKeyRef.current}-${i}`, x: slot.x, row: slot.row };
      })
    );

    if (timeLimit !== 'none') {
      const totalSec = Number(timeLimit);
      setRoundClock(totalSec);
      clockIntervalRef.current = setInterval(() => {
        setRoundClock((v) => {
          if (v === null) return null;
          if (v <= 1) {
            if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
            clockIntervalRef.current = null;
            advanceRound();
            return null;
          }
          return v - 1;
        });
      }, 1000);
    } else {
      setRoundClock(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, categorySet, bubbleCount, boardWidth, timeLimit]);

  // Imperative on purpose (not a setState updater): it calls session.end() /
  // startNextRound() directly, side effects that must run exactly once per
  // call, which a state updater function cannot safely guarantee (React can
  // invoke an updater more than once, e.g. under StrictMode).
  const advanceRound = useCallback(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    const next = roundIndexRef.current + 1;
    roundIndexRef.current = next;
    setRound(next);
    if (next >= TOTAL_ROUNDS) {
      session.end();
      setBubbles([]);
    } else {
      startNextRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNextRound]);

  useEffect(() => {
    if (meta.length > 0 && round === 0 && bubbles.length === 0 && !session.over && !gameOverEarly) {
      startNextRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const goodRemaining = bubbles.filter((b) => b.isGood).length;

  useEffect(() => {
    if (bubbles.length > 0 && goodRemaining === 0 && !session.over) {
      advanceRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goodRemaining]);

  useEffect(() => {
    if (session.over && !recordedRef.current) {
      recordedRef.current = true;
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      recordGameResult('bubble-pop', session.score).then((r) => setBest(r.best));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.over]);

  const handlePop = (id: string) => {
    if (session.over || session.paused) return;
    setBubbles((prev) => {
      const bubble = prev.find((b) => b.id === id);
      if (!bubble) return prev;
      getDb().recordAttempt(bubble.wordId, 'game:bubble-pop', bubble.isGood, 0).catch(() => {});
      if (bubble.isGood) {
        session.bumpCombo();
        session.addScore(Math.round(100 * comboMultiplier(session.combo + 1)));
        return prev.filter((b) => b.id !== id);
      }
      session.resetCombo();
      session.loseLife();
      setFlashId(id);
      setTimeout(() => setFlashId(null), 250);
      setTimeout(() => setBubbles((cur) => cur.filter((b) => b.id !== id)), 260);
      return prev;
    });
  };

  const handleReachTop = (id: string) => {
    setBubbles((prev) => {
      const bubble = prev.find((b) => b.id === id);
      if (!bubble) return prev;
      if (bubble.isGood) {
        session.resetCombo();
        getDb().recordAttempt(bubble.wordId, 'game:bubble-pop', false, 0).catch(() => {});
      }
      return prev.filter((b) => b.id !== id);
    });
  };

  const handleReveal = (id: string) => {
    const bubble = bubbles.find((b) => b.id === id);
    if (!bubble) return;
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setReveal({ wordId: bubble.wordId, learned: bubble.learned, native: bubble.native, isNew: bubble.isNew });
  };

  const closeReveal = () => {
    setReveal(null);
    if (timeLimit !== 'none' && roundClock !== null && roundClock > 0 && !session.over) {
      clockIntervalRef.current = setInterval(() => {
        setRoundClock((v) => {
          if (v === null) return null;
          if (v <= 1) {
            if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
            clockIntervalRef.current = null;
            advanceRound();
            return null;
          }
          return v - 1;
        });
      }, 1000);
    }
  };

  const settingsFields: SettingField[] = [
    {
      key: 'bubbleCount',
      type: 'select',
      label: s.games.bubblePop.bubbleCountLabel,
      options: BUBBLE_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'speed',
      type: 'select',
      label: s.games.bubblePop.speedLabel,
      options: [
        { value: 'slow', label: s.games.bubblePop.speedSlow },
        { value: 'normal', label: s.games.bubblePop.speedNormal },
        { value: 'fast', label: s.games.bubblePop.speedFast },
      ],
    },
    {
      key: 'categorySet',
      type: 'select',
      label: s.games.bubblePop.categorySetLabel,
      options: [
        { value: 'topic', label: s.games.bubblePop.categoryTopic },
        { value: 'pos', label: s.games.bubblePop.categoryPos },
        { value: 'gender', label: s.games.bubblePop.categoryGender },
      ],
    },
    {
      key: 'timeLimit',
      type: 'select',
      label: s.games.bubblePop.timeLimitLabel,
      options: [
        { value: 'none', label: s.games.bubblePop.timeLimitNone },
        { value: '30', label: '30s' },
        { value: '20', label: '20s' },
      ],
    },
  ];

  return (
    <GameShell
      title={gameName(gameDef, contentLang)}
      score={session.score}
      lives={session.lives}
      timeLabel={roundClock !== null ? `${roundClock}s` : undefined}
      onExit={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} hitSlop={12}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </Pressable>

        <Text style={[styles.roundText, { color: colors.tabIconDefault }]}>{s.games.bubblePop.roundOf(Math.min(round + 1, TOTAL_ROUNDS), TOTAL_ROUNDS)}</Text>
        <Text style={[styles.promptText, { color: colors.text }]}>{s.games.bubblePop.prompt(categoryLabel)}</Text>

        <View style={[styles.board, { width: boardWidth, height: boardHeight, borderColor: colors.tabIconDefault }]}>
          {bubbles.map((b) => (
            <Bubble
              key={b.id}
              bubble={b}
              durationMs={SPEED_MS[speed]}
              boardHeight={boardHeight}
              flashRed={flashId === b.id}
              onReachTop={handleReachTop}
              onPop={handlePop}
              onReveal={handleReveal}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>

      {reveal ? (
        <View style={styles.revealOverlayWrap} pointerEvents="box-none">
          <GlossText
            text={reveal.learned}
            glosses={new Map([[normalizeWordToken(reveal.learned), reveal]])}
            learnedLang={learnedLang}
            disableTap
            forceOpen={reveal}
            onForceClose={closeReveal}
            style={styles.hiddenAnchor}
          />
        </View>
      ) : null}

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={{ bubbleCount, speed, categorySet, timeLimit }}
        onChange={(key, value) => {
          if (key === 'bubbleCount') {
            const next = Number(value);
            setBubbleCount(next);
            saveSettings({ bubbleCount: next, speed, categorySet, timeLimit });
          } else if (key === 'speed') {
            const next = value as Speed;
            setSpeed(next);
            saveSettings({ bubbleCount, speed: next, categorySet, timeLimit });
          } else if (key === 'categorySet') {
            const next = value as BubbleCategorySet;
            setCategorySet(next);
            saveSettings({ bubbleCount, speed, categorySet: next, timeLimit });
          } else if (key === 'timeLimit') {
            const next = value as TimeLimit;
            setTimeLimit(next);
            saveSettings({ bubbleCount, speed, categorySet, timeLimit: next });
          }
        }}
        onClose={() => {
          setSettingsOpen(false);
          roundKeyRef.current += 1;
          startNextRound();
        }}
      />

      {session.over ? (
        <GameOverCard
          score={session.score}
          best={best}
          isNewBest={session.score >= best && session.score > 0}
          onPlayAgain={() => load()}
          onExit={() => router.back()}
        />
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 24,
  },
  settingsBtn: {
    alignSelf: 'flex-end',
    marginRight: 20,
  },
  settingsBtnText: {
    fontSize: 20,
  },
  roundText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  promptText: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  board: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bubbleWrap: {
    position: 'absolute',
    top: 0,
  },
  bubbleCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  revealOverlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenAnchor: {
    width: 0,
    height: 0,
  },
});
