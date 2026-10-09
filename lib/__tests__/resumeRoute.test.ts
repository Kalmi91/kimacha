// the app saves the last resumable place and returns to it on a cold start.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { loadResumePath, resumablePath, resumeSteps, saveResumePath, RESUME_GAME_ID } from '../resumeRoute';

const lessonId = syllabusForLevel('A1', 'es').find((t) => hasLesson('es', t.id))!.id;

describe('resumablePath', () => {
  it('the Learn tab, the three other tabs, the lesson and its table drill can be resumed', () => {
    expect(resumablePath('/')).toBe('/');
    expect(resumablePath('/course')).toBe('/course');
    expect(resumablePath('/stats')).toBe('/stats');
    expect(resumablePath('/settings')).toBe('/settings');
    expect(resumablePath(`/grammar/${lessonId}`)).toBe(`/grammar/${lessonId}`);
    expect(resumablePath(`/grammar/deck/${lessonId}`)).toBe(`/grammar/deck/${lessonId}`);
  });

  it('the exam, the placement test, onboarding and the other screens cannot be resumed', () => {
    for (const p of ['/exam', '/mock-exam', '/placement', '/onboarding', '/themes', '/theme-mix', '/credits', '/mistakes', '/grammar', '/grammar/deck', '/nincs']) {
      expect(resumablePath(p)).toBeNull();
    }
  });
});

describe('resumeSteps', () => {
  it('saved tab: goes to the tab', () => {
    expect(resumeSteps('/course', 'es')).toEqual(['/(tabs)/course']);
    expect(resumeSteps('/stats', 'es')).toEqual(['/(tabs)/stats']);
    expect(resumeSteps('/settings', 'es')).toEqual(['/(tabs)/settings']);
  });

  it('saved lesson: goes to the Grammar list, puts the lesson on it (Back leads to the list)', () => {
    expect(resumeSteps(`/grammar/${lessonId}`, 'es')).toEqual(['/(tabs)/course', `/grammar/${lessonId}`]);
  });

  it('saved table drill: list, lesson, drill', () => {
    expect(resumeSteps(`/grammar/deck/${lessonId}`, 'es')).toEqual(['/(tabs)/course', `/grammar/${lessonId}`, `/grammar/deck/${lessonId}`]);
  });

  it('invalid / missing / Learn place: no navigation, the home screen (Learn) stays', () => {
    expect(resumeSteps(null, 'es')).toEqual([]);
    expect(resumeSteps('/', 'es')).toEqual([]);
    expect(resumeSteps('/exam', 'es')).toEqual([]);
    expect(resumeSteps('semmi', 'es')).toEqual([]);
    // deleted / unknown lesson
    expect(resumeSteps('/grammar/nincs-ilyen-lecke', 'es')).toEqual([]);
    expect(resumeSteps('/grammar/deck/nincs-ilyen-lecke', 'es')).toEqual([]);
  });
});

describe('save and read back', () => {
  beforeEach(async () => {
    await getDb().resetGameProgress(RESUME_GAME_ID);
  });

  it('null without a save', async () => {
    expect(await loadResumePath(getDb())).toBeNull();
  });

  it('the saved place can be read back, a newer one overwrites', async () => {
    await saveResumePath(getDb(), '/course');
    expect(await loadResumePath(getDb())).toBe('/course');
    await saveResumePath(getDb(), `/grammar/${lessonId}`);
    expect(await loadResumePath(getDb())).toBe(`/grammar/${lessonId}`);
  });
});
