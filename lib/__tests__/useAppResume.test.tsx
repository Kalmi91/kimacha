// On a cold start it navigates to the saved place (only after finished onboarding), then saves every resumable switch;
// the home screen does not overwrite the save before the restore has run.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => mockPathname,
}));

import { act, renderHook } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { loadResumePath, saveResumePath, RESUME_GAME_ID } from '../resumeRoute';
import { useAppResume } from '../useAppResume';

const lessonId = syllabusForLevel('A1', 'es').find((t) => hasLesson('es', t.id))!.id;

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('useAppResume (FB470)', () => {
  beforeEach(async () => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockPathname = '/';
    await getDb().setOnboarding('en', 'es');
    await getDb().resetGameProgress(RESUME_GAME_ID);
  });

  it('mentett lecke: hidegindításkor a Nyelvtan listára lép, arra a leckére; a Learn kezdőlap nem írja felül a mentést', async () => {
    await saveResumePath(getDb(), `/grammar/${lessonId}`);
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/course');
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${lessonId}`);
    expect(await loadResumePath(getDb())).toBe(`/grammar/${lessonId}`);
  });

  it('mentett fül: a fülre lép', async () => {
    await saveResumePath(getDb(), '/stats');
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/stats');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('érvénytelen mentett hely (törölt lecke): nem navigál, a kezdőlap marad', async () => {
    await saveResumePath(getDb(), '/grammar/nincs-ilyen-lecke');
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('nem a kezdőlapon indult app (mélylink / más útvonal): nem állít vissza, a mostani hely mentődik', async () => {
    await saveResumePath(getDb(), '/stats');
    mockPathname = '/settings';
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await loadResumePath(getDb())).toBe('/settings');
  });

  it('onboarding nélkül (első indítás) nem állít vissza semmit', async () => {
    await saveResumePath(getDb(), '/course');
    renderHook(() => useAppResume(false));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('az indulási ellenőrzés közben (null) nem csinál semmit', async () => {
    await saveResumePath(getDb(), '/course');
    renderHook(() => useAppResume(null));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await loadResumePath(getDb())).toBe('/course');
  });

  it('a visszaállítás után a folytatható váltásokat menti, a vizsgát nem', async () => {
    const { rerender } = renderHook(() => useAppResume(true));
    await flush();

    mockPathname = '/settings';
    rerender({});
    await flush();
    expect(await loadResumePath(getDb())).toBe('/settings');

    mockPathname = '/exam';
    rerender({});
    await flush();
    expect(await loadResumePath(getDb())).toBe('/settings');

    mockPathname = `/grammar/${lessonId}`;
    rerender({});
    await flush();
    expect(await loadResumePath(getDb())).toBe(`/grammar/${lessonId}`);
  });

  it('a Learn fülre visszalépve a Learn az utolsó hely: a következő indulás a kezdőlapon marad', async () => {
    await saveResumePath(getDb(), '/course');
    mockPathname = '/course';
    const { rerender } = renderHook(() => useAppResume(false));
    await flush();
    mockPathname = '/';
    rerender({});
    await flush();
    expect(await loadResumePath(getDb())).toBe('/');
  });
});
