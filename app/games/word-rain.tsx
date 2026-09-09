import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, runOnJS, Easing } from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool, pickStruggler, type PoolEntry } from '@/lib/games/vocabPool';
import type { DistractMode } from '@/lib/games/distract';
import { buildFallingRound, fallingLane, laneFallDurations, type WordRainDirection } from '@/lib/games/wordRain';
import { useGameSession } from '@/lib/games/session';
import { comboMultiplier, getGameBest, recordGameResult } from '@/lib/games/scoring';
import { hashString } from '@/lib/shuffle';
import GameShell from '@/components/games/GameShell';
import GameOverCard from '@/components/games/GameOverCard';
import GlossText from '@/components/games/GlossText';
import CountdownStart from '@/components/games/CountdownStart';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';
import type { GlossInfo } from '@/lib/games/gloss';

// GAMES.md 4.1 (F2, word-rain), A-variáns (K4 DÖNTÉS). One prompt at the
// bottom, several words fall from the top, tap the right one before it (or
// any wrong tap) costs a life. K5 DÖNTÉS: no daily sprint, no separate streak,
// this is free play with just a high score.

type Speed = 'slow' | 'normal' | 'fast';

const SPEED_MS: Record<Speed, number> = { slow: 7000, normal: 5000, fast: 3500 };
const MIN_FALL_MS = 2200;
const FALLING_COUNTS = [3, 4, 5, 6];

interface FallingTile {
  id: string;
  wordId: number;
  text: string;
  isTarget: boolean;
  isNew: boolean;
  x: number;
  width: number; // FB162: the tile owns its lane, so long words cannot overlap
  durationMs: number; // GAMES.md 4.1: every lane falls at its own speed
}

function FallingWordTile({
  tile,
  boardHeight,
  onLand,
  onTap,
  colors,
}: {
  tile: FallingTile;
  boardHeight: number;
  onLand: (id: string) => void;
  onTap: (id: string) => void;
  colors: { text: string; tabIconDefault: string };
}) {
  const translateY = useSharedValue(-30);

  useEffect(() => {
    translateY.value = withTiming(boardHeight, { duration: tile.durationMs, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onLand)(tile.id);
    });
    return () => cancelAnimation(translateY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[styles.fallingTile, { left: tile.x, width: tile.width }, style]}>
      <Pressable onPress={() => onTap(tile.id)} hitSlop={6}>
        <Text
          testID={`word-rain-tile-${tile.id}`}
          numberOfLines={1}
          style={[
            styles.fallingText,
            { color: colors.text },
            tile.isNew ? { color: colors.tabIconDefault, textDecorationLine: 'underline', textDecorationStyle: 'dotted' } : null,
          ]}
        >
          {tile.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function WordRainScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const gameDef = getGameDef('word-rain')!;

  const [pair, setPair] = useState('hu-es');
  const [learnedLang, setLearnedLang] = useState('es');
  const [nativeLang, setNativeLang] = useState('hu');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [direction, setDirection] = useState<WordRainDirection>('forward');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [fallingCount, setFallingCount] = useState(4);
  const [distractorMode, setDistractorMode] = useState<DistractMode>('nearMiss');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [best, setBest] = useState(0);
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [tiles, setTiles] = useState<FallingTile[]>([]);
  // Kept in sync in an effect (not during render), so the landing handler can
  // read the current board without a render-time ref write.
  const tilesRef = useRef<FallingTile[]>([]);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);
  const [roundKey, setRoundKey] = useState(0);
  const [intro, setIntro] = useState<{ info: GlossInfo } | null>(null);

  const session = useGameSession({ startLives: 3, onLivesDepleted: () => finishRun() });
  const totalCorrectRef = useRef(0);
  const introducedRef = useRef<Set<number>>(new Set());
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetRef = useRef<number | null>(null);
  const catchStartRef = useRef(0);
  const recordedRef = useRef(false);

  const boardHeight = 380;
  const boardWidth = Math.min(windowWidth - 32, 380);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    const activePair = `${source}-${target}`;
    setPair(activePair);
    setLearnedLang(target);
    setNativeLang(source);
    setContentLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');

    const levelData = await db.getLevel();
    setLevel(levelData.level as Level);

    const savedSettings = await db.getGameSettings('word-rain');
    const savedDirection = (savedSettings?.direction as WordRainDirection) ?? 'forward';
    const savedSpeed = (savedSettings?.speed as Speed) ?? 'normal';
    const savedCount = (savedSettings?.fallingCount as number) ?? 4;
    const savedDistract = (savedSettings?.distractorMode as DistractMode) ?? 'nearMiss';
    setDirection(savedDirection === 'reverse' ? 'reverse' : 'forward');
    setSpeed(savedSpeed in SPEED_MS ? savedSpeed : 'normal');
    setFallingCount(FALLING_COUNTS.includes(savedCount) ? savedCount : 4);
    setDistractorMode(savedDistract === 'random' ? 'random' : 'nearMiss');

    const bestRow = await getGameBest('word-rain');
    setBest(bestRow?.bestScore ?? 0);

    const p = await getLearnedPool({ pair: activePair, learnedLang: target, level: levelData.level as Level, minSize: 20 });
    setPool(p);

    totalCorrectRef.current = 0;
    introducedRef.current = new Set();
    lastTargetRef.current = null;
    recordedRef.current = false;
    session.reset();
    setStarted(false);
    setTiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (next: { direction: WordRainDirection; speed: Speed; fallingCount: number; distractorMode: DistractMode }) => {
    getDb().setGameSettings('word-rain', next).catch(() => {});
  };

  const currentDurationMs = useCallback(() => {
    const base = SPEED_MS[speed];
    const steps = Math.floor(totalCorrectRef.current / 10);
    return Math.max(MIN_FALL_MS, Math.round(base * Math.pow(0.92, steps)));
  }, [speed]);

  const effectiveDistractorMode = useCallback((): DistractMode => {
    return totalCorrectRef.current >= 20 ? 'nearMiss' : distractorMode;
  }, [distractorMode]);

  const spawnRound = useCallback(
    (entry: PoolEntry) => {
      const round = buildFallingRound(entry, pool, {
        direction,
        learnedLang,
        nativeLang,
        fallingCount,
        distractorMode: effectiveDistractorMode(),
        seed: hashString(`${entry.wordId}:${roundKey}`),
      });

      const durations = laneFallDurations(
        round.words.length,
        currentDurationMs(),
        hashString(`fall:${entry.wordId}:${roundKey}`),
        MIN_FALL_MS
      );
      const newTiles: FallingTile[] = round.words.map((w, i) => {
        const lane = fallingLane(i, round.words.length, boardWidth);
        return {
          id: `${roundKey}-${i}`,
          wordId: w.wordId,
          text: w.text,
          isTarget: w.isTarget,
          isNew: w.isTarget && entry.isNew,
          x: lane.x,
          width: lane.width,
          durationMs: durations[i],
        };
      });

      setPrompt(round.prompt);
      setTiles(newTiles);
      catchStartRef.current = Date.now();
    },
    [direction, learnedLang, nativeLang, pool, effectiveDistractorMode, currentDurationMs, fallingCount, roundKey, boardWidth]
  );

  const nextRound = useCallback(() => {
    if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
    if (pool.length === 0) return;
    // FB162 follow-up: the target is drawn weight-proportionally, so the words the
    // learner keeps missing come up most often and the buried "I know this" ones
    // only now and then (lib/games/vocabPool.ts).
    let entry: PoolEntry;
    let tries = 0;
    do {
      entry = pickStruggler(pool) ?? pool[0];
      tries++;
    } while (entry.wordId === lastTargetRef.current && pool.length > 1 && tries < 10);
    lastTargetRef.current = entry.wordId;

    setRoundKey((k) => k + 1);

    if (entry.isNew && !introducedRef.current.has(entry.wordId)) {
      introducedRef.current.add(entry.wordId);
      session.pause();
      setIntro({ info: { wordId: entry.wordId, learned: entry.learned, native: entry.native, isNew: true } });
      introTimerRef.current = setTimeout(() => {
        introTimerRef.current = null;
        setIntro(null);
        session.resume();
        spawnRound(entry);
      }, 1800);
      return;
    }
    spawnRound(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, spawnRound]);

  // Only freezes the board (session.over itself already flips from
  // loseLife()); the actual recordGameResult() call happens once, in the
  // session.over effect below, guarded by recordedRef.
  const finishRun = useCallback(() => {
    setTiles([]);
  }, []);

  useEffect(() => {
    if (session.over && !recordedRef.current) {
      recordedRef.current = true;
      recordGameResult('word-rain', session.score).then((r) => setBest(r.best));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.over]);

  const handleCatch = (correct: boolean, tile: FallingTile) => {
    if (session.over || session.paused) return;
    getDb().recordAttempt(tile.wordId, 'game:word-rain', correct, Date.now() - catchStartRef.current).catch(() => {});
    session.recordAttempt(tile.wordId, correct);
    if (correct) {
      totalCorrectRef.current += 1;
      session.bumpCombo();
      const reaction = Date.now() - catchStartRef.current;
      const points = Math.round(100 * comboMultiplier(session.combo + 1)) + (reaction < 1500 ? 50 : 0);
      session.addScore(points);
      setTiles([]);
      nextRound();
    } else {
      session.resetCombo();
      session.loseLife();
      setTiles((prev) => prev.filter((tl) => tl.id !== tile.id));
    }
  };

  // Losing a life, logging the miss and starting the next round are side
  // effects, so they run here rather than inside a setTiles updater: React can
  // call an updater more than once for one event, and a double call would cost
  // two lives for one missed word (the FB162 crash was this same shape).
  const handleLand = (id: string) => {
    const tile = tilesRef.current.find((tl) => tl.id === id);
    if (!tile) return;
    if (!tile.isTarget) {
      setTiles((prev) => prev.filter((tl) => tl.id !== id));
      return;
    }
    session.resetCombo();
    session.loseLife();
    getDb().recordAttempt(tile.wordId, 'game:word-rain', false, Date.now() - catchStartRef.current).catch(() => {});
    setTiles([]);
    nextRound();
  };

  // Passed to the tile as a plain reference rather than an inline arrow: a
  // lambda built inside the tiles.map() render loop looks like render-time work
  // to the React Compiler, which then flags the Date.now() reaction timing in
  // handleCatch as an impure render call.
  const handleTap = (id: string) => {
    const tile = tilesRef.current.find((tl) => tl.id === id);
    if (tile) handleCatch(tile.isTarget, tile);
  };

  const settingsFields: SettingField[] = [
    {
      key: 'direction',
      type: 'select',
      label: s.games.wordRain.directionLabel,
      options: [
        { value: 'forward', label: s.games.wordRain.directionForward },
        { value: 'reverse', label: s.games.wordRain.directionReverse },
      ],
    },
    {
      key: 'speed',
      type: 'select',
      label: s.games.wordRain.speedLabel,
      options: [
        { value: 'slow', label: s.games.wordRain.speedSlow },
        { value: 'normal', label: s.games.wordRain.speedNormal },
        { value: 'fast', label: s.games.wordRain.speedFast },
      ],
    },
    {
      key: 'fallingCount',
      type: 'stepper',
      label: s.games.wordRain.fallingCountLabel,
      min: 3,
      max: 6,
      step: 1,
    },
    {
      key: 'distractorMode',
      type: 'select',
      label: s.games.wordRain.distractorLabel,
      options: [
        { value: 'random', label: s.games.wordRain.distractorRandom },
        { value: 'nearMiss', label: s.games.wordRain.distractorNearMiss },
      ],
    },
  ];

  const introGloss = useMemo(() => intro?.info ?? null, [intro]);

  return (
    <GameShell
      title={gameName(gameDef, contentLang)}
      score={session.score}
      lives={session.lives}
      combo={session.combo}
      paused={session.paused}
      pauseOverlay={!intro}
      onExit={() => router.back()}
    >
      <View style={styles.body}>
        <Pressable style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} hitSlop={12}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </Pressable>

        {!started ? (
          <View style={styles.startWrap}>
            <Pressable
              style={[styles.startBtn, { backgroundColor: colors.tint }]}
              onPress={() => {
                setStarted(true);
              }}
            >
              <Text style={styles.startBtnText}>{s.games.play}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.board, { width: boardWidth, height: boardHeight, borderColor: colors.tabIconDefault }]}>
              {tiles.map((tile) => (
                <FallingWordTile
                  key={tile.id}
                  tile={tile}
                  boardHeight={boardHeight}
                  onLand={handleLand}
                  onTap={handleTap}
                  colors={colors}
                />
              ))}
            </View>
            <View style={[styles.promptBar, { backgroundColor: colors.card }]}>
              <Text testID="word-rain-prompt" style={[styles.promptText, { color: colors.text }]}>
                {prompt}
              </Text>
            </View>
          </>
        )}

        {intro && introGloss ? (
          <View style={styles.introOverlay}>
            <View style={[styles.introCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.introLabel, { color: colors.tabIconDefault }]}>{s.games.newWordHint}</Text>
              <GlossText
                text={introGloss.learned}
                glosses={new Map([[normalizeWordToken(introGloss.learned), introGloss]])}
                learnedLang={learnedLang}
                disableTap
                forceOpen={introGloss}
                onForceClose={() => {}}
                style={[styles.introWord, { color: colors.text }]}
              />
              <Text style={[styles.introNative, { color: colors.tint }]}>{introGloss.native}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={{ direction, speed, fallingCount, distractorMode }}
        onChange={(key, value) => {
          if (key === 'direction') {
            const next = value as WordRainDirection;
            setDirection(next);
            saveSettings({ direction: next, speed, fallingCount, distractorMode });
          } else if (key === 'speed') {
            const next = value as Speed;
            setSpeed(next);
            saveSettings({ direction, speed: next, fallingCount, distractorMode });
          } else if (key === 'fallingCount') {
            const next = Number(value);
            setFallingCount(next);
            saveSettings({ direction, speed, fallingCount: next, distractorMode });
          } else if (key === 'distractorMode') {
            const next = value as DistractMode;
            setDistractorMode(next);
            saveSettings({ direction, speed, fallingCount, distractorMode: next });
          }
        }}
        onClose={() => {
          setSettingsOpen(false);
          if (started && tiles.length === 0 && !session.over) nextRound();
        }}
      />

      {started && !session.over && tiles.length === 0 && !intro ? <CountdownStartBridge onDone={nextRound} /> : null}

      {session.over ? (
        <GameOverCard
          score={session.score}
          best={best}
          isNewBest={session.score >= best && session.score > 0}
          onPlayAgain={() => load().then(() => setStarted(true))}
          onExit={() => router.back()}
        />
      ) : null}
    </GameShell>
  );
}

// The very first round of a run gets the 3-2-1 countdown; subsequent rounds
// (new prompts within the same run) start immediately, GAMES.md 4.1 only
// describes one countdown per session, not per prompt.
function CountdownStartBridge({ onDone }: { onDone: () => void }) {
  const firedRef = useRef(false);
  return (
    <CountdownStart
      onDone={() => {
        if (firedRef.current) return;
        firedRef.current = true;
        onDone();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
  },
  settingsBtn: {
    alignSelf: 'flex-end',
    marginRight: 20,
  },
  settingsBtnText: {
    fontSize: 20,
  },
  startWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 28,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  board: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  fallingTile: {
    position: 'absolute',
    top: 0,
  },
  fallingText: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'center',
  },
  promptBar: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 26,
    fontWeight: '800',
  },
  introOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  introCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  introLabel: {
    fontSize: 13,
  },
  introWord: {
    fontSize: 28,
    fontWeight: '800',
  },
  introNative: {
    fontSize: 18,
  },
});
