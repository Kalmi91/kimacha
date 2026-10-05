import type { DB } from '@/lib/database';
import type { QueuedSm2Card } from '@/lib/pcicSession';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// FB470 (kártya-szintű folytatás): a Learn-kör ott folytatódik, ahol az app bezárásakor abbamaradt. A sor a
// mentett SRS-állapotból eleve újraépül (az értékelt kártyák mentve vannak); ez a pillanatkép ráteszi az
// újraépült sorra a SORRENDET (a soron lévő kártya, a rontott kártya helye) és az "again" időzítőket, valamint a
// "+N új szó" adag csíkjának alapját (batchBase). Nem mentődik: a félig begépelt / felfedett válasz.
// Napváltáskor és szintváltáskor a pillanatkép érvénytelen (a sor a normál úton épül); ami már nem esedékes vagy
// nem létezik, az az újraépült sorban sincs, ezért kiesik.

const LEARN_KEY = 'learn';

export interface LearnResume {
  day: string;
  level: string;
  /** A sor tételei sorrendben, az első a soron lévő kártya. */
  order: string[];
  /** A rontott ("again") kártyák visszatérési ideje (ms, Date.now() alapú). */
  returns: Record<string, number>;
  /** A "+N új szó" adag alapja (a nap addig kész kártyái a bővítéskor), vagy null, ha nincs aktív adag. */
  base: number | null;
}

export function buildLearnResume(queue: QueuedSm2Card[], day: string, level: string, base: number | null): LearnResume {
  const returns: Record<string, number> = {};
  for (const c of queue) if (c.returnAt !== undefined) returns[c.itemId] = c.returnAt;
  return { day, level, order: queue.map((c) => c.itemId), returns, base };
}

/** Érvényes-e a pillanatkép erre a napra és szintre. */
export function isLearnResumeFor(saved: LearnResume | null, day: string, level: string): saved is LearnResume {
  return saved !== null && saved.day === day && saved.level === level;
}

/**
 * A normál módon újraépült sorra rárakja a mentett sorrendet: a mentett tételek (ami még a sorban van) a mentett
 * sorrendben előre kerülnek, a rontott kártyák visszakapják az időzítőjüket; a sor többi tétele a normál
 * sorrendjében követi őket. Érvénytelen pillanatkép (másik nap / szint) esetén a sor változatlan.
 */
export function applyLearnResume(queue: QueuedSm2Card[], saved: LearnResume | null, day: string, level: string): QueuedSm2Card[] {
  if (!isLearnResumeFor(saved, day, level)) return queue;
  const rest = new Map(queue.map((c) => [c.itemId, c]));
  const head: QueuedSm2Card[] = [];
  for (const id of saved.order) {
    const card = rest.get(id);
    if (!card) continue;
    rest.delete(id);
    head.push(saved.returns[id] !== undefined ? { ...card, returnAt: saved.returns[id] } : card);
  }
  return [...head, ...queue.filter((c) => rest.has(c.itemId))];
}

function parseLearnResume(raw: unknown): LearnResume | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<LearnResume>;
  if (typeof r.day !== 'string' || typeof r.level !== 'string') return null;
  if (!Array.isArray(r.order) || !r.order.every((id) => typeof id === 'string')) return null;
  const returns: Record<string, number> = {};
  if (typeof r.returns === 'object' && r.returns !== null) {
    for (const [id, at] of Object.entries(r.returns)) if (typeof at === 'number') returns[id] = at;
  }
  return { day: r.day, level: r.level, order: r.order, returns, base: typeof r.base === 'number' ? r.base : null };
}

export async function loadLearnResume(db: DB): Promise<LearnResume | null> {
  return parseLearnResume(await loadResumeValue(db, LEARN_KEY));
}

export async function saveLearnResume(db: DB, resume: LearnResume): Promise<void> {
  await saveResumeValue(db, LEARN_KEY, resume);
}

/** A haladás nullázása után a pillanatkép a régi állapotra szólt, ezért eldobódik. */
export async function clearLearnResume(db: DB): Promise<void> {
  await saveResumeValue(db, LEARN_KEY, null);
}
