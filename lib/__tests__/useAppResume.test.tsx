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

  it('saved lesson: on cold start goes to the Grammar list, to that lesson; the Learn home does not overwrite the save', async () => {
    await saveResumePath(getDb(), `/grammar/${lessonId}`);
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/course');
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${lessonId}`);
    expect(await loadResumePath(getDb())).toBe(`/grammar/${lessonId}`);
  });

  it('saved tab: goes to the tab', async () => {
    await saveResumePath(getDb(), '/stats');
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/stats');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invalid saved place (deleted lesson): does not navigate, the home screen stays', async () => {
    await saveResumePath(getDb(), '/grammar/nincs-ilyen-lecke');
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('app not started on the home screen (deep link / other route): does not restore, the current place is saved', async () => {
    await saveResumePath(getDb(), '/stats');
    mockPathname = '/settings';
    renderHook(() => useAppResume(true));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await loadResumePath(getDb())).toBe('/settings');
  });

  it('without onboarding (first launch) it restores nothing', async () => {
    await saveResumePath(getDb(), '/course');
    renderHook(() => useAppResume(false));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('during the startup check (null) it does nothing', async () => {
    await saveResumePath(getDb(), '/course');
    renderHook(() => useAppResume(null));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await loadResumePath(getDb())).toBe('/course');
  });

  it('after the restore it saves the resumable switches, not the exam', async () => {
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

  it('returning to the Learn tab, Learn is the last place: the next launch stays on the home screen', async () => {
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
