import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, PanResponder, ScrollView, useWindowDimensions, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool, type PoolEntry } from '@/lib/games/vocabPool';
import { buildGrid, normalizeForGrid, type WordSearchDirections, type WordPlacement } from '@/lib/games/wordSearch';
import { mulberry32, hashString } from '@/lib/shuffle';
import { useGameSession } from '@/lib/games/session';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GameShell from '@/components/games/GameShell';
import GameOverCard from '@/components/games/GameOverCard';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';

// GAMES.md 4.4 (F1, word-search). K9 DÖNTÉS: the side list is always in the
// SOURCE language (fixed, no toggle). Drag-select via PanResponder, no new
// native dependency. The grid itself comes from lib/games/wordSearch.ts.

const GRID_SIZES = ['6x6', '8x8', '10x10', '12x12'] as const;
type GridSizeKey = (typeof GRID_SIZES)[number];
const sizeOf = (key: GridSizeKey): number => parseInt(key.split('x')[0], 10);

const WORD_COUNTS = [4, 6, 8, 10];

interface Cell {
  row: number;
  col: number;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function cellsEqual(a: Cell | null, b: Cell | null): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

function pathFrom(start: Cell, current: Cell): Cell[] {
  const dr = Math.sign(current.row - start.row);
  const dc = Math.sign(current.col - start.col);
  const dist = Math.max(Math.abs(current.row - start.row), Math.abs(current.col - start.col));
  const path: Cell[] = [];
  for (let i = 0; i <= dist; i++) path.push({ row: start.row + dr * i, col: start.col + dc * i });
  return path;
}

function matchesPlacement(path: Cell[], placement: WordPlacement): boolean {
  if (path.length !== placement.word.length) return false;
  const start = path[0];
  const end = path[path.length - 1];
  const dr = path.length > 1 ? Math.sign(path[1].row - path[0].row) : 0;
  const dc = path.length > 1 ? Math.sign(path[1].col - path[0].col) : 0;

  const forward = start.row === placement.row && start.col === placement.col && dr === placement.dr && dc === placement.dc;
  const placementEndRow = placement.row + placement.dr * (placement.word.length - 1);
  const placementEndCol = placement.col + placement.dc * (placement.word.length - 1);
  const backward =
    end.row === placement.row &&
    end.col === placement.col &&
    start.row === placementEndRow &&
    start.col === placementEndCol &&
    dr === -placement.dr &&
    dc === -placement.dc;

  return forward || backward;
}

export default function WordSearchScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const gameDef = getGameDef('word-search')!;

  const [pair, setPair] = useState('hu-es');
  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [gridSizeKey, setGridSizeKey] = useState<GridSizeKey>('8x8');
  const [wordCount, setWordCount] = useState(6);
  const [dirs, setDirs] = useState<WordSearchDirections>('orthogonal');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [placements, setPlacements] = useState<WordPlacement[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [best, setBest] = useState(0);
  const [selStart, setSelStart] = useState<Cell | null>(null);
  const [selPath, setSelPath] = useState<Cell[]>([]);

  const recordedRef = useRef(false);
  const boxRef = useRef<View>(null);
  const boxLayout = useRef({ x: 0, y: 0, size: 1 });

  const session = useGameSession({ startLives: 0 });

  const size = sizeOf(gridSizeKey);
  const containerSize = Math.min(windowWidth - 40, 360);
  const cellPx = containerSize / size;

  // The PanResponder below is built ONCE (useRef) so its gesture handlers stay
  // stable across re-renders; that means any plain state/const it reads
  // (size, placements, found, entries) would otherwise be frozen at the value
  // from the render that first created it. Refs, kept in sync every render,
  // are how the handlers see the CURRENT values instead of a stale snapshot.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const foundRef = useRef(found);
  foundRef.current = found;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const startRound = useCallback(
    async (p: string, learned: string, lvl: Level, gridKey: GridSizeKey, count: number, directions: WordSearchDirections) => {
      const sz = sizeOf(gridKey);
      const pool = await getLearnedPool({ pair: p, learnedLang: learned, level: lvl, minSize: count * 5 });
      const seen = new Set<string>();
      const candidates: PoolEntry[] = [];
      for (const e of pool) {
        const norm = normalizeForGrid(e.learned);
        if (norm.length < 2 || norm.length > sz || seen.has(norm)) continue;
        seen.add(norm);
        candidates.push(e);
        if (candidates.length >= count) break;
      }

      const seed = hashString(`${p}:${lvl}:${gridKey}:${count}:${directions}:${Date.now()}`);
      const built = buildGrid(candidates.map((e) => e.learned), sz, directions, mulberry32(seed), learned);
      const placedWords = new Set(built.placements.map((pl) => pl.word));
      const placedEntries = candidates.filter((e) => placedWords.has(normalizeForGrid(e.learned)));

      setEntries(placedEntries);
      setGrid(built.grid);
      setPlacements(built.placements);
      setFound(new Set());
      setSelStart(null);
      setSelPath([]);
      recordedRef.current = false;
      session.reset();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session]
  );

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

    const savedSettings = await db.getGameSettings('word-search');
    const savedGrid = (savedSettings?.gridSize as GridSizeKey) ?? '8x8';
    const savedCount = (savedSettings?.wordCount as number) ?? 6;
    const savedDirs = (savedSettings?.dirs as WordSearchDirections) ?? 'orthogonal';
    const grid2 = GRID_SIZES.includes(savedGrid) ? savedGrid : '8x8';
    const count2 = WORD_COUNTS.includes(savedCount) ? savedCount : 6;
    const dirs2 = (['orthogonal', 'diagonal', 'reverse'] as const).includes(savedDirs) ? savedDirs : 'orthogonal';
    setGridSizeKey(grid2);
    setWordCount(count2);
    setDirs(dirs2);

    const bestRow = await getGameBest('word-search');
    setBest(bestRow?.bestScore ?? 0);

    await startRound(activePair, target, levelData.level as Level, grid2, count2, dirs2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (next: { gridSize: GridSizeKey; wordCount: number; dirs: WordSearchDirections }) => {
    getDb().setGameSettings('word-search', next).catch(() => {});
  };

  const cellToRowCol = (pageX: number, pageY: number): Cell | null => {
    const { x, y, size: boxSize } = boxLayout.current;
    const sz = sizeRef.current;
    const cell = boxSize / sz;
    const col = Math.floor((pageX - x) / cell);
    const row = Math.floor((pageY - y) / cell);
    if (row < 0 || row >= sz || col < 0 || col >= sz) return null;
    return { row, col };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const cell = cellToRowCol(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (cell) {
          setSelStart(cell);
          setSelPath([cell]);
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
        setSelStart((start) => {
          if (!start) return start;
          const cell = cellToRowCol(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          if (cell) setSelPath(pathFrom(start, cell));
          return start;
        });
      },
      onPanResponderRelease: () => {
        setSelPath((path) => {
          if (path.length > 1) {
            for (const placement of placementsRef.current) {
              if (foundRef.current.has(placement.word)) continue;
              if (matchesPlacement(path, placement)) {
                setFound((prev) => new Set(prev).add(placement.word));
                session.addScore(300);
                const matchedEntry = entriesRef.current.find((e) => normalizeForGrid(e.learned) === placement.word);
                if (matchedEntry) {
                  getDb().recordAttempt(matchedEntry.wordId, 'game:word-search', true, 0).catch(() => {});
                }
                break;
              }
            }
          }
          return [];
        });
        setSelStart(null);
      },
    })
  ).current;

  const allFound = entries.length > 0 && entries.every((e) => found.has(normalizeForGrid(e.learned)));

  useEffect(() => {
    if (allFound && !recordedRef.current) {
      recordedRef.current = true;
      session.end();
      const timeBonus = Math.max(0, 3000 - Math.floor(session.elapsedMs / 1000) * 15);
      session.addScore(timeBonus);
      recordGameResult('word-search', session.score + timeBonus).then((r) => setBest(r.best));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFound]);

  const selectedSet = useMemo(() => new Set(selPath.map((c) => `${c.row},${c.col}`)), [selPath]);
  const foundCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of placements) {
      if (!found.has(p.word)) continue;
      for (let i = 0; i < p.word.length; i++) set.add(`${p.row + p.dr * i},${p.col + p.dc * i}`);
    }
    return set;
  }, [placements, found]);

  const settingsFields: SettingField[] = [
    {
      key: 'gridSize',
      type: 'select',
      label: s.games.wordSearch.gridSizeLabel,
      options: GRID_SIZES.map((g) => ({ value: g, label: g })),
    },
    {
      key: 'wordCount',
      type: 'select',
      label: s.games.wordSearch.wordCountLabel,
      options: WORD_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'dirs',
      type: 'select',
      label: s.games.wordSearch.directionsLabel,
      options: [
        { value: 'orthogonal', label: s.games.wordSearch.dirOrthogonal },
        { value: 'diagonal', label: s.games.wordSearch.dirDiagonal },
        { value: 'reverse', label: s.games.wordSearch.dirReverse },
      ],
    },
  ];

  const foundCount = entries.filter((e) => found.has(normalizeForGrid(e.learned))).length;

  return (
    <GameShell
      title={gameName(gameDef, contentLang)}
      score={session.score}
      timeLabel={formatElapsed(session.elapsedMs)}
      onExit={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.progressText, { color: colors.text }]}>{s.games.wordSearch.foundOf(foundCount, entries.length)}</Text>
          <Text style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} suppressHighlighting>
            ⚙️
          </Text>
        </View>

        <View
          ref={boxRef}
          style={[styles.gridBox, { width: containerSize, height: containerSize }]}
          onLayout={() => {
            boxRef.current?.measureInWindow((x, y, w) => {
              boxLayout.current = { x, y, size: w };
            });
          }}
          {...panResponder.panHandlers}
        >
          {grid.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((letter, c) => {
                const key = `${r},${c}`;
                const isSelected = selectedSet.has(key);
                const isFoundCell = foundCellSet.has(key);
                return (
                  <View
                    key={c}
                    testID={`ws-cell-${r}-${c}`}
                    style={[
                      styles.cell,
                      { width: cellPx, height: cellPx },
                      isFoundCell ? { backgroundColor: colors.tint } : null,
                      isSelected && !isFoundCell ? { backgroundColor: colors.tabIconDefault } : null,
                    ]}
                  >
                    <Text style={[styles.cellText, { color: isFoundCell || isSelected ? '#FFFFFF' : colors.text }]}>{letter}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.list}>
          {entries.map((entry) => {
            const norm = normalizeForGrid(entry.learned);
            const isFound = found.has(norm);
            return (
              <View key={entry.wordId} testID={`ws-target-${entry.wordId}`} style={styles.listRow}>
                {isFound ? (
                  <GlossText
                    text={entry.learned}
                    glosses={new Map([[normalizeWordToken(entry.learned), { wordId: entry.wordId, learned: entry.learned, native: entry.native, isNew: entry.isNew }]])}
                    learnedLang={learnedLang}
                    onOpenGloss={session.pause}
                    onCloseGloss={session.resume}
                    style={[styles.listText, { color: colors.tint, textDecorationLine: 'line-through' }]}
                  />
                ) : (
                  <Text style={[styles.listText, { color: colors.text }, entry.isNew ? styles.listTextNew : null]}>{entry.native}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={{ gridSize: gridSizeKey, wordCount: String(wordCount), dirs }}
        onChange={(key, value) => {
          if (key === 'gridSize') {
            const next = value as GridSizeKey;
            setGridSizeKey(next);
            saveSettings({ gridSize: next, wordCount, dirs });
            startRound(pair, learnedLang, level, next, wordCount, dirs);
          } else if (key === 'wordCount') {
            const next = Number(value);
            setWordCount(next);
            saveSettings({ gridSize: gridSizeKey, wordCount: next, dirs });
            startRound(pair, learnedLang, level, gridSizeKey, next, dirs);
          } else if (key === 'dirs') {
            const next = value as WordSearchDirections;
            setDirs(next);
            saveSettings({ gridSize: gridSizeKey, wordCount, dirs: next });
            startRound(pair, learnedLang, level, gridSizeKey, wordCount, next);
          }
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {allFound ? (
        <GameOverCard
          score={session.score}
          best={best}
          isNewBest={session.score >= best && session.score > 0}
          onPlayAgain={() => startRound(pair, learnedLang, level, gridSizeKey, wordCount, dirs)}
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
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsBtn: {
    fontSize: 20,
  },
  gridBox: {
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    width: '100%',
    gap: 6,
  },
  listRow: {
    paddingVertical: 2,
  },
  listText: {
    fontSize: 15,
  },
  listTextNew: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
});
