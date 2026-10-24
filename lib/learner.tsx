import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { DEFAULT_AGAIN_DELAY_SEC } from '@/lib/pcicSession';

// The learner's settings in one place: the active direction (onboarding source + target), the level of that
// pair and the per-pair switches (accent strictness, missed-word delay, article picker, the 💬 side). The
// store is the only code that reads them from / writes them to the db and the only caller of
// data/pcic.ts setPcicTarget, so "the direction is set before the deck is built" is the store's job, not a comment
// in every screen.
//
// Reading: a screen asks for exactly the fields it used to read (`refresh(['direction', 'level'])`), so the db
// calls it makes are unchanged; the fresh snapshot comes back and the store keeps it for everyone who renders
// `useLearner()` values. A session screen that builds a queue takes its copy from the returned snapshot and
// commits it together with the queue (a direction change from another tab must not flip half of the screen).
// Writing: the store state is updated first (the row appears to change at once), then the db write follows.

export type LearnerField =
  | 'direction'
  | 'hasLevel'
  | 'level'
  | 'strictAccents'
  | 'againDelaySec'
  | 'articlePicker'
  | 'feedbackBtnSide';

export interface LearnerState {
  // false until a direction was saved (the onboarding has not finished yet).
  onboarded: boolean;
  // UI language / native language of the active pair (onboarding.source); null before onboarding.
  source: string | null;
  // The target language of the active pair (onboarding.target); 'es' until a direction was read or previewed.
  target: PcicTarget;
  level: PcicLevel;
  // whether the active pair has an explicitly chosen level (the db fallback does not count).
  hasLevel: boolean;
  strictAccents: boolean;
  againDelaySec: number;
  articlePicker: boolean;
  feedbackBtnSide: 'left' | 'right';
}

export interface LearnerActions {
  refresh: (fields: LearnerField[]) => Promise<LearnerState>;
  setOnboarding: (source: string, target: PcicTarget) => Promise<void>;
  // The onboarding language step: the direction is tried before anything is saved.
  previewTarget: (target: PcicTarget, source?: string) => void;
  setLevel: (level: PcicLevel) => Promise<void>;
  setStrictAccents: (v: boolean) => Promise<void>;
  setAgainDelaySec: (sec: number) => Promise<void>;
  setArticlePicker: (v: boolean) => Promise<void>;
  setFeedbackBtnSide: (side: 'left' | 'right') => Promise<void>;
}

export type Learner = LearnerState & LearnerActions;

export class LearnerStore {
  private state: LearnerState = {
    onboarded: false,
    source: null,
    target: 'es',
    level: 'B1',
    hasLevel: false,
    strictAccents: false,
    againDelaySec: DEFAULT_AGAIN_DELAY_SEC,
    articlePicker: true,
    feedbackBtnSide: 'right',
  };
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private commit(patch: Partial<LearnerState>) {
    // an unchanged snapshot keeps its identity, so a refresh that learns nothing new renders nothing.
    const changed = (Object.keys(patch) as (keyof LearnerState)[]).some((k) => patch[k] !== this.state[k]);
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  refresh = async (fields: LearnerField[]): Promise<LearnerState> => {
    const db = getDb();
    const patch: Partial<LearnerState> = {};
    const want = (f: LearnerField) => fields.includes(f);
    // The direction comes first: the deck of the level below is built from the active target.
    if (want('direction')) {
      const o = await db.getOnboarding();
      if (o) {
        patch.onboarded = true;
        patch.source = o.source;
        patch.target = o.target as PcicTarget;
        setPcicTarget(patch.target, patch.source);
      } else {
        // not onboarded yet: the previewed direction (if any) stays.
        patch.onboarded = false;
        patch.source = null;
      }
    }
    if (want('hasLevel')) patch.hasLevel = await db.hasPcicLevel();
    if (want('level')) patch.level = await db.getPcicLevel();
    if (want('strictAccents')) patch.strictAccents = await db.getStrictAccents();
    if (want('againDelaySec')) patch.againDelaySec = await db.getAgainDelaySec();
    if (want('articlePicker')) patch.articlePicker = await db.getArticlePicker();
    if (want('feedbackBtnSide')) patch.feedbackBtnSide = await db.getFeedbackBtnSide();
    this.commit(patch);
    return this.state;
  };

  setOnboarding = async (source: string, target: PcicTarget) => {
    await getDb().setOnboarding(source, target);
    setPcicTarget(target, source);
    this.commit({ onboarded: true, source, target });
  };

  previewTarget = (target: PcicTarget, source?: string) => {
    setPcicTarget(target, source);
    this.commit({ target });
  };

  setLevel = async (level: PcicLevel) => {
    await getDb().setPcicLevel(level);
    this.commit({ level, hasLevel: true });
  };

  setStrictAccents = async (v: boolean) => {
    this.commit({ strictAccents: v });
    await getDb().setStrictAccents(v);
  };

  setAgainDelaySec = async (sec: number) => {
    this.commit({ againDelaySec: sec });
    await getDb().setAgainDelaySec(sec);
  };

  setArticlePicker = async (v: boolean) => {
    this.commit({ articlePicker: v });
    await getDb().setArticlePicker(v);
  };

  setFeedbackBtnSide = async (side: 'left' | 'right') => {
    this.commit({ feedbackBtnSide: side });
    await getDb().setFeedbackBtnSide(side);
  };

  actions: LearnerActions = {
    refresh: this.refresh,
    setOnboarding: this.setOnboarding,
    previewTarget: this.previewTarget,
    setLevel: this.setLevel,
    setStrictAccents: this.setStrictAccents,
    setAgainDelaySec: this.setAgainDelaySec,
    setArticlePicker: this.setArticlePicker,
    setFeedbackBtnSide: this.setFeedbackBtnSide,
  };
}

const LearnerContext = createContext<LearnerStore | null>(null);

// The app root creates the store (it needs it before the tree mounts, for the startup check) and hands it down.
export function LearnerProvider({ store, children }: { store: LearnerStore; children: ReactNode }) {
  return <LearnerContext.Provider value={store}>{children}</LearnerContext.Provider>;
}

// Without a provider (a screen rendered on its own) the component gets a private store, so it behaves the
// same standalone; the actions are stable, the state fields are the current snapshot.
export function useLearner(): Learner {
  const shared = useContext(LearnerContext);
  const [own] = useState(() => (shared ? null : new LearnerStore()));
  const store = shared ?? own!;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { ...state, ...store.actions };
}
