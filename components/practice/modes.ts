// The modes of the Practice tab: Reading (the tab's own round, app/(tabs)/practice.tsx) plus the games below.
// To add a game: (1) its round logic in lib/practice/<mode>.ts as a GameLogic (start, parse) and its screen in components/practice/<Mode>Game.tsx,
// built on useGameRound + GameFrame + creditRight / creditWrong (copy DictationGame.tsx); (2) one entry in PRACTICE_MODES below, and its
// chip title in practiceTab (lib/i18n/{en,es}/learn.ts). The chip row, the saved choice, the 8-word round, resume, summary and
// empty state need nothing more. Every testID of the game starts with `<mode>-`.

import { useCallback, useState, type ComponentType } from 'react';

import DictationGame from '@/components/practice/DictationGame';
import MatchGame from '@/components/practice/MatchGame';
import OppositesGame from '@/components/practice/OppositesGame';
import ScrambleGame from '@/components/practice/ScrambleGame';
import SituationGame from '@/components/practice/SituationGame';
import type { t } from '@/lib/i18n';
import { DICTATION_MODE } from '@/lib/practice/dictation';
import { MATCH_MODE } from '@/lib/practice/match';
import { OPPOSITES_MODE } from '@/lib/practice/opposites';
import { SCRAMBLE_MODE } from '@/lib/practice/scramble';
import { SITUATIONS_MODE } from '@/lib/practice/situations';
import { loadPracticeMode, resolvePracticeMode, savePracticeMode } from '@/lib/practice/practiceMode';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

export interface PracticeMode {
  /** Chip id, save key and testID prefix of the game. */
  id: string;
  /** The chip title, from the UI strings. */
  title: (s: ReturnType<typeof t>) => string;
  Component: ComponentType;
}

export const PRACTICE_MODES: readonly PracticeMode[] = [
  { id: DICTATION_MODE, title: (s) => s.practiceTab.modeDictation, Component: DictationGame },
  { id: SCRAMBLE_MODE, title: (s) => s.practiceTab.modeScramble, Component: ScrambleGame },
  { id: MATCH_MODE, title: (s) => s.practiceTab.modeMatch, Component: MatchGame },
  { id: OPPOSITES_MODE, title: (s) => s.practiceTab.modeOpposites, Component: OppositesGame },
  { id: SITUATIONS_MODE, title: (s) => s.practiceTab.modeSituations, Component: SituationGame },
];

/**
 * The state of the Practice tab's mode chips: all games, the mode to show (the last chosen one,
 * otherwise Reading) and `select`. `ready` is false until the saved choice is read.
 */
export function usePracticeMode() {
  const enabled = PRACTICE_MODES;
  // undefined = the saved choice is not read yet
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const loadSaved = useCallback(async () => {
    setSaved(await loadPracticeMode());
  }, []);
  useLoadOnMount(loadSaved);
  const activeId = resolvePracticeMode(saved ?? null, enabled.map((m) => m.id));
  const select = useCallback((id: string) => {
    setSaved(id);
    void savePracticeMode(id);
  }, []);
  return {
    ready: saved !== undefined,
    enabled,
    activeId,
    active: enabled.find((m) => m.id === activeId),
    select,
  };
}
