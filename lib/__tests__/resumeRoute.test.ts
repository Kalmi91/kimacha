// az app az utolsó folytatható helyet menti, és hidegindításkor oda lép vissza.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { loadResumePath, resumablePath, resumeSteps, saveResumePath, RESUME_GAME_ID } from '../resumeRoute';

const lessonId = syllabusForLevel('A1', 'es').find((t) => hasLesson('es', t.id))!.id;

describe('resumablePath', () => {
  it('a Learn fül, a három másik fül, a lecke és a táblás gyakorlata folytatható', () => {
    expect(resumablePath('/')).toBe('/');
    expect(resumablePath('/course')).toBe('/course');
    expect(resumablePath('/stats')).toBe('/stats');
    expect(resumablePath('/settings')).toBe('/settings');
    expect(resumablePath(`/grammar/${lessonId}`)).toBe(`/grammar/${lessonId}`);
    expect(resumablePath(`/grammar/deck/${lessonId}`)).toBe(`/grammar/deck/${lessonId}`);
  });

  it('a vizsga, a szintfelmérés, az onboarding és a többi képernyő nem folytatható', () => {
    for (const p of ['/exam', '/mock-exam', '/placement', '/onboarding', '/themes', '/theme-mix', '/credits', '/mistakes', '/grammar', '/grammar/deck', '/nincs']) {
      expect(resumablePath(p)).toBeNull();
    }
  });
});

describe('resumeSteps', () => {
  it('mentett fül: a fülre lép', () => {
    expect(resumeSteps('/course', 'es')).toEqual(['/(tabs)/course']);
    expect(resumeSteps('/stats', 'es')).toEqual(['/(tabs)/stats']);
    expect(resumeSteps('/settings', 'es')).toEqual(['/(tabs)/settings']);
  });

  it('mentett lecke: a Nyelvtan listára lép, arra teszi a leckét (a Vissza a listára visz)', () => {
    expect(resumeSteps(`/grammar/${lessonId}`, 'es')).toEqual(['/(tabs)/course', `/grammar/${lessonId}`]);
  });

  it('mentett táblás gyakorlat: lista, lecke, gyakorlat', () => {
    expect(resumeSteps(`/grammar/deck/${lessonId}`, 'es')).toEqual(['/(tabs)/course', `/grammar/${lessonId}`, `/grammar/deck/${lessonId}`]);
  });

  it('érvénytelen / hiányzó / Learn hely: nincs navigáció, a kezdőlap (Learn) marad', () => {
    expect(resumeSteps(null, 'es')).toEqual([]);
    expect(resumeSteps('/', 'es')).toEqual([]);
    expect(resumeSteps('/exam', 'es')).toEqual([]);
    expect(resumeSteps('semmi', 'es')).toEqual([]);
    // törölt / ismeretlen lecke
    expect(resumeSteps('/grammar/nincs-ilyen-lecke', 'es')).toEqual([]);
    expect(resumeSteps('/grammar/deck/nincs-ilyen-lecke', 'es')).toEqual([]);
  });
});

describe('mentés és visszaolvasás', () => {
  beforeEach(async () => {
    await getDb().resetGameProgress(RESUME_GAME_ID);
  });

  it('mentés nélkül null', async () => {
    expect(await loadResumePath(getDb())).toBeNull();
  });

  it('a mentett hely visszaolvasható, az újabb felülírja', async () => {
    await saveResumePath(getDb(), '/course');
    expect(await loadResumePath(getDb())).toBe('/course');
    await saveResumePath(getDb(), `/grammar/${lessonId}`);
    expect(await loadResumePath(getDb())).toBe(`/grammar/${lessonId}`);
  });
});
