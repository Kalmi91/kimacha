import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getPcicTarget, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { LearnerProvider, LearnerStore, useLearner } from '@/lib/learner';

jest.mock('@/lib/database', () => ({ getDb: jest.fn() }));

const calls: string[] = [];
const db = {
  getOnboarding: jest.fn(async () => {
    calls.push('getOnboarding');
    return { source: 'es', target: 'en' };
  }),
  setOnboarding: jest.fn(async () => {}),
  hasPcicLevel: jest.fn(async () => true),
  getPcicLevel: jest.fn(async () => 'A2'),
  setPcicLevel: jest.fn(async () => {}),
  getStrictAccents: jest.fn(async () => true),
  setStrictAccents: jest.fn(async () => {}),
  getAgainDelaySec: jest.fn(async () => 90),
  getArticlePicker: jest.fn(async () => false),
  getFeedbackBtnSide: jest.fn(async () => 'left'),
  setFeedbackBtnSide: jest.fn(async () => {}),
};

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  setPcicTarget('es');
  (getDb as jest.Mock).mockReturnValue(db);
});

describe('LearnerStore', () => {
  it('reads only the requested fields and sets the deck direction when the direction is read', async () => {
    const store = new LearnerStore();
    const state = await store.refresh(['direction', 'strictAccents']);
    expect(state).toMatchObject({ onboarded: true, source: 'es', target: 'en', strictAccents: true });
    expect(getPcicTarget()).toBe('en');
    expect(db.getPcicLevel).not.toHaveBeenCalled();
    expect(db.getAgainDelaySec).not.toHaveBeenCalled();
    // the fields not asked for keep their defaults
    expect(state.level).toBe('B1');
    expect(state.againDelaySec).toBe(60);
  });

  it('reads the level fields from the db', async () => {
    const store = new LearnerStore();
    const state = await store.refresh(['hasLevel', 'level', 'againDelaySec', 'articlePicker', 'feedbackBtnSide']);
    expect(state).toMatchObject({ hasLevel: true, level: 'A2', againDelaySec: 90, articlePicker: false, feedbackBtnSide: 'left' });
  });

  it('keeps the previewed direction while nothing is saved yet', async () => {
    db.getOnboarding.mockResolvedValueOnce(null as never);
    const store = new LearnerStore();
    store.previewTarget('en');
    const state = await store.refresh(['direction']);
    expect(state).toMatchObject({ onboarded: false, source: null, target: 'en' });
    expect(getPcicTarget()).toBe('en');
  });

  it('writes the direction and the level to the db and keeps them in the state', async () => {
    const store = new LearnerStore();
    await store.setOnboarding('es', 'en');
    await store.setLevel('B2');
    expect(db.setOnboarding).toHaveBeenCalledWith('es', 'en');
    expect(db.setPcicLevel).toHaveBeenCalledWith('B2');
    expect(store.getState()).toMatchObject({ onboarded: true, source: 'es', target: 'en', level: 'B2', hasLevel: true });
    expect(getPcicTarget()).toBe('en');
  });

  it('a switch shows in the state before the db write ends', async () => {
    let finish: () => void = () => {};
    db.setStrictAccents.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    const store = new LearnerStore();
    const pending = store.setStrictAccents(true);
    expect(store.getState().strictAccents).toBe(true);
    finish();
    await pending;
    expect(db.setStrictAccents).toHaveBeenCalledWith(true);
  });

  it('a refresh that learns nothing new keeps the snapshot identity', async () => {
    const store = new LearnerStore();
    await store.refresh(['strictAccents']);
    const before = store.getState();
    await store.refresh(['strictAccents']);
    expect(store.getState()).toBe(before);
  });
});

describe('useLearner', () => {
  it('works without a provider (a private store)', async () => {
    const { result } = renderHook(() => useLearner());
    expect(result.current.target).toBe('es');
    await act(async () => {
      await result.current.refresh(['direction']);
    });
    expect(result.current.target).toBe('en');
  });

  it('shares one state between the components under a provider', async () => {
    const store = new LearnerStore();
    const wrapper = ({ children }: { children: ReactNode }) => <LearnerProvider store={store}>{children}</LearnerProvider>;
    const a = renderHook(() => useLearner(), { wrapper });
    const b = renderHook(() => useLearner(), { wrapper });
    await act(async () => {
      await a.result.current.setFeedbackBtnSide('left');
    });
    expect(b.result.current.feedbackBtnSide).toBe('left');
    expect(db.setFeedbackBtnSide).toHaveBeenCalledWith('left');
  });

  it('keeps the action functions stable across renders', async () => {
    const { result, rerender } = renderHook(() => useLearner());
    const first = result.current.refresh;
    await act(async () => {
      await result.current.refresh(['strictAccents']);
    });
    rerender({});
    expect(result.current.refresh).toBe(first);
  });
});
