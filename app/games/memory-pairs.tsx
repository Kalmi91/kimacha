import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool, type PoolEntry } from '@/lib/games/vocabPool';
import { useGameSession } from '@/lib/games/session';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GameShell from '@/components/games/GameShell';
import GameOverCard from '@/components/games/GameOverCard';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';
import type { GlossInfo } from '@/lib/games/gloss';

// GAMES.md 4.3 (F1, memory-pairs). K8 DÖNTÉS: default 4x4 (8 pairs), word ↔
// meaning only (sentence-gap / voice pairing not built), TTS on match.

const GRID_SIZES: Record<string, { cols: number; rows: number; pairs: number }> = {
  '4x3': { cols: 4, rows: 3, pairs: 6 },
  '4x4': { cols: 4, rows: 4, pairs: 8 },
  '5x4': { cols: 5, rows: 4, pairs: 10 },
  '6x5': { cols: 6, rows: 5, pairs: 15 },
};

interface MemCard {
  id: string;
  wordId: number;
  side: 'learned' | 'native';
  text: string;
  isNew: boolean;
  matched: boolean;
}

function shuffleDeck<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MemoryPairsScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('memory-pairs')!;

  const [pair, setPair] = useState('hu-es');
  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [gridSize, setGridSize] = useState<'4x3' | '4x4' | '5x4' | '6x5'>('4x4');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [cards, setCards] = useState<MemCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); // true while a mismatched pair is resolving
  const [mismatches, setMismatches] = useState(0);
  const [best, setBest] = useState(0);
  const [revealing, setRevealing] = useState<{ cardId: string; info: GlossInfo } | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introducedRef = useRef<Set<number>>(new Set());
  const recordedRef = useRef(false);

  const session = useGameSession({ startLives: 0 });

  const startRound = useCallback(async (p: string, learned: string, lvl: Level, grid: keyof typeof GRID_SIZES) => {
    const pairsNeeded = GRID_SIZES[grid].pairs;
    const pool: PoolEntry[] = await getLearnedPool({ pair: p, learnedLang: learned, level: lvl, minSize: pairsNeeded });
    const entries = pool.slice(0, pairsNeeded);

    const deck: MemCard[] = [];
    for (const entry of entries) {
      deck.push({ id: `${entry.wordId}-l`, wordId: entry.wordId, side: 'learned', text: entry.learned, isNew: entry.isNew, matched: false });
      deck.push({ id: `${entry.wordId}-n`, wordId: entry.wordId, side: 'native', text: entry.native, isNew: entry.isNew, matched: false });
    }
    setCards(shuffleDeck(deck));
    setFlipped([]);
    setMismatches(0);
    introducedRef.current = new Set();
    recordedRef.current = false;
    session.reset();
  }, [session]);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    const activePair = `${source}-${target}`;
    setPair(activePair);
    setLearnedLang(target);
    setContentLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');

    const levelData = await db.getLevel();
    setLevel(levelData.level as Level);

    const savedSettings = await db.getGameSettings('memory-pairs');
    const savedGrid = (savedSettings?.gridSize as string) ?? '4x4';
    const savedTts = savedSettings?.tts !== undefined ? !!savedSettings.tts : true;
    setGridSize((savedGrid in GRID_SIZES ? savedGrid : '4x4') as '4x3' | '4x4' | '5x4' | '6x5');
    setTtsEnabled(savedTts);

    const bestRow = await getGameBest('memory-pairs');
    setBest(bestRow?.bestScore ?? 0);

    await startRound(activePair, target, levelData.level as Level, (savedGrid in GRID_SIZES ? savedGrid : '4x4') as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = useCallback((next: { gridSize: string; tts: boolean }) => {
    getDb().setGameSettings('memory-pairs', next).catch(() => {});
  }, []);

  const allMatched = cards.length > 0 && cards.every((c) => c.matched);

  useEffect(() => {
    if (allMatched && !recordedRef.current) {
      recordedRef.current = true;
      session.end();
      const timeBonus = Math.max(0, 300 - Math.floor(session.elapsedMs / 1000)) * 2;
      const finalScore = Math.max(0, 1000 - mismatches * 20 + timeBonus);
      session.addScore(finalScore);
      recordGameResult('memory-pairs', finalScore).then((r) => setBest(r.best));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatched]);

  const findGlossInfo = (card: MemCard): GlossInfo => {
    const other = cards.find((c) => c.wordId === card.wordId && c.side !== card.side);
    return {
      wordId: card.wordId,
      learned: card.side === 'learned' ? card.text : other?.text ?? card.text,
      native: card.side === 'native' ? card.text : other?.text ?? card.text,
      isNew: card.isNew,
    };
  };

  const onCardPress = (card: MemCard) => {
    if (session.paused || busy || card.matched || flipped.includes(card.id) || flipped.length >= 2) return;

    const nextFlipped = [...flipped, card.id];
    setFlipped(nextFlipped);

    // K2-style auto reveal (GAMES.md 4.3: "az első felfordításkor ... kiírja
    // alá a jelentést"), only for a NEW learned-side word, once per run.
    if (card.side === 'learned' && card.isNew && !introducedRef.current.has(card.wordId)) {
      introducedRef.current.add(card.wordId);
      session.pause();
      setRevealing({ cardId: card.id, info: findGlossInfo(card) });
      revealTimer.current = setTimeout(() => {
        setRevealing(null);
        session.resume();
      }, 2000);
    }

    if (nextFlipped.length === 2) {
      const [aId, bId] = nextFlipped;
      const a = cards.find((c) => c.id === aId)!;
      const b = cards.find((c) => c.id === bId)!;
      if (a.wordId === b.wordId && a.side !== b.side) {
        setCards((prev) => prev.map((c) => (c.id === aId || c.id === bId ? { ...c, matched: true } : c)));
        setFlipped([]);
        getDb().recordAttempt(a.wordId, 'game:memory-pairs', true, 0).catch(() => {});
        if (ttsEnabled) {
          const learnedCard = a.side === 'learned' ? a : b;
          speak(learnedCard.text, speechLang(learnedLang));
        }
      } else {
        setBusy(true);
        getDb().recordAttempt(a.wordId, 'game:memory-pairs', false, 0).catch(() => {});
        if (b.wordId !== a.wordId) {
          getDb().recordAttempt(b.wordId, 'game:memory-pairs', false, 0).catch(() => {});
        }
        setTimeout(() => {
          setFlipped([]);
          setMismatches((m) => m + 1);
          setBusy(false);
        }, 800);
      }
    }
  };

  const { cols } = GRID_SIZES[gridSize];
  const cellSize = Math.min(84, Math.floor(340 / cols));

  const settingsFields: SettingField[] = [
    {
      key: 'gridSize',
      type: 'select',
      label: s.games.memoryPairs.gridSizeLabel,
      options: [
        { value: '4x3', label: s.games.memoryPairs.pairsLabel(6) },
        { value: '4x4', label: s.games.memoryPairs.pairsLabel(8) },
        { value: '5x4', label: s.games.memoryPairs.pairsLabel(10) },
        { value: '6x5', label: s.games.memoryPairs.pairsLabel(15) },
      ],
    },
    { key: 'tts', type: 'toggle', label: s.games.memoryPairs.ttsLabel },
  ];

  return (
    <GameShell
      title={gameName(gameDef, contentLang)}
      score={session.score}
      timeLabel={formatElapsed(session.elapsedMs)}
      paused={session.paused}
      pauseOverlay={!revealing}
      onExit={() => router.back()}
      onPauseToggle={() => (session.paused ? session.resume() : session.pause())}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} hitSlop={12}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </Pressable>

        <View style={[styles.grid, { width: cols * (cellSize + 6) }]}>
          {cards.map((card, index) => {
            const faceUp = flipped.includes(card.id) || card.matched;
            return (
              <Pressable
                key={card.id}
                testID={`mem-card-${index}`}
                onPress={() => onCardPress(card)}
                style={[
                  styles.card,
                  { width: cellSize, height: cellSize, backgroundColor: faceUp ? colors.card : colors.tint },
                  card.matched ? styles.cardMatched : null,
                ]}
              >
                {faceUp ? (
                  card.side === 'learned' ? (
                    <GlossText
                      text={card.text}
                      glosses={new Map([[normalizeWordToken(card.text), findGlossInfo(card)]])}
                      learnedLang={learnedLang}
                      disableTap
                      forceOpen={revealing?.cardId === card.id ? revealing.info : null}
                      style={[styles.cardText, { color: colors.text }]}
                    />
                  ) : (
                    <Text style={[styles.cardText, { color: colors.text }]} numberOfLines={2}>
                      {card.text}
                    </Text>
                  )
                ) : (
                  <Text style={styles.cardBack}>?</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={{ gridSize, tts: ttsEnabled }}
        onChange={(key, value) => {
          if (key === 'gridSize') {
            const next = value as '4x3' | '4x4' | '5x4' | '6x5';
            setGridSize(next);
            saveSettings({ gridSize: next, tts: ttsEnabled });
            startRound(pair, learnedLang, level, next);
          } else if (key === 'tts') {
            setTtsEnabled(!!value);
            saveSettings({ gridSize, tts: !!value });
          }
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {allMatched ? (
        <GameOverCard
          score={session.score}
          best={best}
          isNewBest={session.score >= best && session.score > 0}
          onPlayAgain={() => startRound(pair, learnedLang, level, gridSize)}
          onExit={() => router.back()}
        />
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  settingsBtn: {
    alignSelf: 'flex-end',
    marginRight: 20,
    marginBottom: 4,
  },
  settingsBtnText: {
    fontSize: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  card: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  cardMatched: {
    opacity: 0.55,
  },
  cardText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardBack: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
