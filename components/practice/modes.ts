// The modes of the Practice tab: Reading (the tab's own round, app/(tabs)/practice.tsx) plus the beta games below.
// To add a game: (1) a flag in lib/beta.ts (BetaFlag, BETA_FLAGS, BETA_DEFAULTS true) and its label in lib/i18n/{en,es}/settings.ts beta;
// (2) its round logic in lib/practice/<mode>.ts as a GameLogic (start, parse) and its screen in components/practice/<Mode>Game.tsx,
// built on useGameRound + GameFrame + creditRight / creditWrong (copy DictationGame.tsx); (3) one entry in PRACTICE_MODES below, and its
// chip title in practiceTab (lib/i18n/{en,es}/learn.ts). The chip row, the saved choice, the 8-word round, resume, summary and
// empty state need nothing more. Every testID of the game starts with `<mode>-`.

import { useCallback, useState, type ComponentType } from 'react';

import DictationGame from '@/components/practice/DictationGame';
import ScrambleGame from '@/components/practice/ScrambleGame';
import { useBetaEnabled, type BetaFlag } from '@/lib/beta';
import type { t } from '@/lib/i18n';
import { DICTATION_MODE } from '@/lib/practice/dictation';
import { SCRAMBLE_MODE } from '@/lib/practice/scramble';
import { loadPracticeMode, resolvePracticeMode, savePracticeMode } from '@/lib/practice/practiceMode';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

export interface PracticeMode {
  /** Chip id, save key and testID prefix of the game. */
  id: string;
  /** The beta switch that shows the game (Settings -> Beta); off = no chip. */
  flag: BetaFlag;
  /** The chip title, from the UI strings. */
  title: (s: ReturnType<typeof t>) => string;
  Component: ComponentType;
}

export const PRACTICE_MODES: readonly PracticeMode[] = [
  { id: DICTATION_MODE, flag: 'practiceDictation', title: (s) => s.practiceTab.modeDictation, Component: DictationGame },
  { id: SCRAMBLE_MODE, flag: 'practiceScramble', title: (s) => s.practiceTab.modeScramble, Component: ScrambleGame },
];

const MODE_FLAGS = PRACTICE_MODES.map((m) => m.flag);

/**
 * The state of the Practice tab's mode chips: the games that are switched on, the mode to show (the last chosen one while
 * it is still on, otherwise Reading) and `select`. `ready` is false until the saved choice is read, but only while a game
 * is on; with only Reading on there is nothing to choose and the tab renders at once.
 */
export function usePracticeMode() {
  const on = useBetaEnabled(MODE_FLAGS);
  const enabled = PRACTICE_MODES.filter((m) => on.includes(m.flag));
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
    ready: enabled.length === 0 || saved !== undefined,
    enabled,
    activeId,
    active: enabled.find((m) => m.id === activeId),
    select,
  };
}
