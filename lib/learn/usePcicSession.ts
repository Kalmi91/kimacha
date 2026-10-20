import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';

import { getDb } from '@/lib/database';
import { getBeta, useBeta } from '@/lib/beta';
import { pairOf } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { localDateString, DEFAULT_DAILY_NEW_LIMIT } from '@/lib/usageStats';
import { addXp, getXp, wholeXp, xpForCard, type DailyXp } from '@/lib/dailyXp';
import { pcicItemsForLevel, findPcicItem, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { gradePcicAnswer, gradeSentenceAnswer, type PcicGrade } from '@/lib/pcicMatch';
import { articleOf, composeAnswer, type ArticlePick } from '@/lib/articlePicker';
import { sm2Review, pickSm2Session, sm2MarkKnown, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { countDoneToday, countIntroducedTodayByKind, requeueAfterGrade, requeueAfterUndo, DEFAULT_AGAIN_DELAY_SEC, nextPcicNewBonus, pcicSessionNewLimit, practiceTopUpStep, PCIC_NEW_BONUS_STEP, thinSentences, dropOrphanCards, countFinishedToday } from '@/lib/pcicSession';
import { cardsForLevel } from '@/lib/pcicLevels';
import { applyLearnResume, buildLearnResume, isLearnResumeFor, loadLearnResume, saveLearnResume } from '@/lib/learnResume';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { resolvedTensesFromLessons, type ResolvedTense } from '@/lib/knownSentence';
import { INITIAL_CADENCE, nextSentenceStep, type CadenceState, type SentenceCardData } from '@/lib/sentenceCards';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { examStatusFor, examUnlock, levelHasLesson, type ExamLevelStatus } from '@/lib/exam/unlock';
import { useScreenLoad } from '@/lib/useScreenLoad';

// How long the level picker sheet takes to close (the RN-web Modal's 250 ms exit animation, which starts about 100 ms late, plus a margin).
const SHEET_CLOSE_MS = 500;

// The PCIC tab. English -> Spanish typing, with Anki buttons
// (again/hard/good/easy), on the standalone SM-2 scheduler (lib/sm2.ts).
// It does not use the FSRS `cards`/`sessionQueue` scheduler and does not touch it.

// Sentence thinning (thinSentences).
function pcicIntroOrder(memberIds: string[]): string[] {
  return thinSentences(memberIds, (id) => findPcicItem(id)?.kind, (id) => id);
}

// Snapshot of one undoable grade. `counted` = whether it also advanced the
// counters (the "Don't learn this" button will write false here).
interface UndoEntry {
  before: Sm2Card;
  after: Sm2Card;
  typed: string;
  grade: PcicGrade | null;
  wasNew: boolean;
  g: Sm2Grade;
  counted: boolean;
  // The sentence-card cadence as it was before the grade.
  cadenceBefore: CadenceState;
  // The XP this grade added (undo takes it back); absent when it added none.
  xp?: { date: string; points: number };
}

// The PCIC tab's learning session: state, SRS stepping (SM-2), XP and streak writes,
// level switching and the resume snapshot. The screen (app/(tabs)/index.tsx) renders it
// through components/learn/PcicCardView.tsx.
export function usePcicSession() {
  // beta: xpV2, the XP v2 values (lib/dailyXp.ts); off = the original 3/2 XP.
  const xpV2 = useBeta('xpV2');

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [level, setLevel] = useState<PcicLevel>('B1');
  // The target language of the active pair (onboarding.target);
  // it decides the card's prompt/answer direction, the TTS locale and how the
  // article button row / posOf appear.
  const [target, setTarget] = useState<PcicTarget>('es');
  // The level picker sheet: the N/total progress it shows
  // needs the cards of ALL four levels, not just the active one.
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [allLevelCards, setAllLevelCards] = useState<Sm2Card[]>([]);
  // The level exam rows (A1-B2) on the level picker sheet.
  const [examLevels, setExamLevels] = useState<ExamLevelStatus[]>([]);
  // The Settings accent-strictness switch also applies to PCIC
  // typing (the strictAccents param of gradePcicAnswer).
  const [strictAccents, setStrictAccents] = useState(false);
  // The stepper of the Settings "Missed word comes back
  // after"; it supplies the returnAt of the "again" branch of requeueAfterGrade.
  const [againDelaySec, setAgainDelaySec] = useState(DEFAULT_AGAIN_DELAY_SEC);
  const [allCards, setAllCards] = useState<Map<string, Sm2Card>>(new Map());
  const [queue, setQueue] = useState<Sm2Card[]>([]);
  // Number of cards already finished today when the "+N new words" expansion happens; the bar measures the new batch relative to this.
  // The base applies to ONE LEVEL (finished cards are counted at the viewed level) and is not valid on another level.
  const [batchBase, setBatchBase] = useState<{ day: string; level: string; n: number }>({ day: '', level: '', n: 0 });
  const [typedAnswer, setTypedAnswer] = useState('');
  const [articlePick, setArticlePick] = useState<ArticlePick>('');
  const [grade, setGrade] = useState<PcicGrade | null>(null);
  // Open/closed state of the (i) explanation. It stores the itemId (not
  // a boolean), so that closing on a card change is a DERIVED state, without an effect
  // (react-hooks/set-state-in-effect).
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [sessionAgain, setSessionAgain] = useState(0);
  const [lastGraded, setLastGraded] = useState<UndoEntry | null>(null);
  // Today's XP from the card grades (lib/dailyXp.ts); `date` tells when it was written,
  // so a screen left open past midnight shows 0 again (see xpToday below).
  const [dailyXp, setDailyXp] = useState<DailyXp>({ date: '', xp: 0 });
  // After every 4th new word, 1 sentence card (alternating
  // assemble and typing), practice only: it does not write SRS. `tenses` are the
  // tenses unlocked by completed grammar lessons (lib/knownSentence.ts).
  const [cadence, setCadence] = useState<CadenceState>(INITIAL_CADENCE);
  const [sentenceCard, setSentenceCard] = useState<SentenceCardData | null>(null);
  const [tenses, setTenses] = useState<ReadonlySet<ResolvedTense>>(new Set());
  // The daily budget expanded with the "+10 new words" button,
  // persisted in the learn_settings.new_bonus/new_bonus_date columns (it
  // expires with the calendar day); load() reads it back from the DB, it does not reset it.
  const [pcicBonus, setPcicBonus] = useState(0);
  // The Settings "New words a day" (learn_settings.daily_new_limit,
  // previously read only by the deleted Learn tab) now also sets the number of
  // PCIC daily new items; the header's "new" chip counts from it (queue state === 'new').
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);
  // Measured height of the docked Check/Next bar, for the scroll view's bottom padding
  // and for the 💬 bottomOffset (DockedAction.tsx; Learn's DOCK_RESERVE is the default).
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  // The docked bar rises above the keyboard, as on the Learn tab.
  const { dockLift, kbHeight } = useDockLift();
  // The input field gets focus on every NEW card (see the
  // effect below), not only on first mount (the `autoFocus` prop is not
  // enough for this, because the TextInput does not remount on a card change).
  const inputRef = useRef<TextInput>(null);
  // In-flight guard of handleGrade: a double tap must not grade the same card twice.
  const gradingRef = useRef(false);
  // The input field REMOUNTS on every new card
  // (the TextInput `key` contains this counter). Reason: after Check the field
  // became `editable={false}`, then editable again after Next, on the same
  // native EditText. On Android a field that was disabled and then re-enabled keeps
  // its old InputConnection / composing state: `focus()` sometimes does not
  // open the keyboard, and deleting from text that Gboard still considers
  // "being typed" does not work. A fresh field =
  // a fresh InputConnection + `autoFocus`, which opens the keyboard on every mount.
  // The counter also covers the case when the same card comes back (again).
  const [cardSeq, setCardSeq] = useState(0);

  // `overrideLevel` for the immediate switch coming from the level picker sheet,
  // so that there is no need to wait a render round for setLevel (the new level is
  // already in the db, load() just re-reads it with it).
  const load = useCallback(async (overrideLevel?: PcicLevel) => {
    const db = getDb();
    const day = localDateString();
    // The target language of the active pair decides which direction's
    // deck is built (data/pcic.ts setPcicTarget); it must come BEFORE the
    // pcicItemsForLevel call, otherwise the words of the old direction would come.
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    setPcicTarget(dir);
    setTarget(dir);
    // If the active pair does not yet have an explicitly chosen level (Settings
    // direction switch to a direction that was not onboarded earlier; a fresh onboarding
    // always makes the user choose, so it never gets here unchosen), the level picker sheet
    // opens by itself, the same sheet as when tapping the header chip.
    if (!overrideLevel && !(await db.hasPcicLevel())) setLevelSheetOpen(true);
    const lvl = overrideLevel ?? (await db.getPcicLevel());
    const newOrder = pcicItemsForLevel(lvl).map((i) => i.id);
    const rawCards = await db.getPcicCards();
    // Skips the orphaned SRS rows of the old PCIC corpus (item ids that
    // no longer exist in the loaded corpus) before the
    // session is built from them.
    const cards = dropOrphanCards(cardsForLevel(rawCards, lvl), (id) => findPcicItem(id) !== undefined);
    const strict = await db.getStrictAccents();
    const newLimit = await db.getDailyNewLimit();
    const delaySec = await db.getAgainDelaySec();
    const bonus = await db.getPcicNewBonus(day);
    // The tenses unlocked by completed grammar lessons
    // (the tense gate exists only for Spanish as the target language).
    const grammarRows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
    const introducedToday = cards.filter((c) => c.introducedAt === day).length;
    // The daily budget is DAILY: items introduced today are counted across all levels (lib/pcicSession.ts pcicSessionNewLimit).
    const introducedAllLevels = dropOrphanCards(rawCards, (id) => findPcicItem(id) !== undefined).filter((c) => c.introducedAt === day).length;
    setTenses(resolvedTensesFromLessons(doneGrammarTopicProgress(dir, grammarRows).keys()));
    setLevel(lvl);
    setAllLevelCards(rawCards);
    const examGrammarRows = dir === 'es' ? grammarRows : await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    // Only a level that has a written lesson has a row (otherwise the exam could never open).
    const examResults = await db.getExamResults();
    setExamLevels(
      EXAM_LEVELS.filter((l) => levelHasLesson(l, dir)).map((l) => examStatusFor(l, dir, rawCards, examGrammarRows, examResults[l])),
    );
    setStrictAccents(strict);
    setDailyNewLimit(newLimit);
    setAgainDelaySec(delaySec);
    setToday(day);
    setDailyXp(await getXp(day));
    setAllCards(new Map(cards.map((c) => [c.itemId, c])));
    // Card-level resume: the saved order and the "again" timers are put back on the rebuilt queue (invalid after a day change / level change).
    const resume = await loadLearnResume(db);
    setQueue(applyLearnResume(pickSm2Session(cards, pcicIntroOrder(newOrder), day, pcicSessionNewLimit({ limit: newLimit, bonus, introducedAllLevels, introducedThisLevel: introducedToday })), resume, day, lvl));
    if (isLearnResumeFor(resume, day, lvl) && resume.base !== null) setBatchBase({ day, level: lvl, n: resume.base });
    setTypedAnswer('');
    setGrade(null);
    setSessionAnswered(0);
    setSessionNew(0);
    setSessionAgain(0);
    setLastGraded(null);
    setSentenceCard(null);
    setPcicBonus(bonus);
    setLoading(false);
    // setTypedAnswer is listed because the React Compiler infers it as a
    // dependency of this async callback; it
    // is stable, so nothing changes at runtime, but an empty array here counts
    // as broken memoization.
  }, [setTypedAnswer]);

  // A refocus with the deck already on screen refreshes it without the spinner.
  useScreenLoad(load, { hasData: !loading, setLoading });

  // Tapping in the level picker sheet immediately gives the deck of the chosen level
  // (the sheet closes first, so the switch does not look frozen).
  const handleSelectLevel = async (lvl: PcicLevel) => {
    setLevelSheetOpen(false);
    if (lvl === level) return;
    await getDb().setPcicLevel(lvl);
    setLoading(true);
    await load(lvl);
  };

  // The three paths of the exam row: the exam starts, practicing the missing
  // words (the A1 deck), or the grammar lessons (if only the lesson is missing).
  // The sheet closes FIRST, and we navigate on only after the exit animation (web: 250 ms): if the push
  // immediately puts this screen in the background, the Modal's exit does not complete and the sheet stays
  // above the new screen.
  const closeSheetThen = (go: () => void) => {
    setLevelSheetOpen(false);
    setTimeout(go, SHEET_CLOSE_MS);
  };
  // The level picker sheet's quiet entry point to the adaptive placement test.
  const openPlacement = () => closeSheetThen(() => router.push('/placement'));

  const newOrder = useMemo(() => pcicItemsForLevel(level).map((i) => i.id), [level]);
  const current = queue[0];
  const currentItem = current ? findPcicItem(current.itemId) : undefined;

  // The FeedbackButton's pair label with the active direction
  // (it used to be hard-coded to "es-en", although the actual behavior was en-es).
  const languagePair = pairOf(target);

  // The prompt is the source-language field and the answer is the
  // target-language one; in en-es this is the old order (prompt en, answer es), in es-en
  // the reverse. `sourceLang` is the language of the prompt/read-aloud, `target` that of the answer.
  const sourceLang = target === 'es' ? 'en' : 'es';

  const promptSource = target === 'es' ? currentItem?.en : currentItem?.es;
  const answerText = target === 'es' ? currentItem?.es : currentItem?.en;

  // Reading the prompt aloud AND focusing the input field when a
  // NEW card comes on screen (the keyboard opens). It should run only on a
  // change of `current?.itemId` (`grade` is read from the closure and
  // decides that it is not revealed yet); on reveal (when the `grade` state
  // changes) it should not repeat, neither the read-aloud nor the focus.
  // Under a sentence card the next prompt is not spoken;
  // it is spoken when the card closes (sentenceOpen false), like on a new card.
  const sentenceOpen = sentenceCard !== null;
  useEffect(() => {
    if (!loading && !sentenceOpen && currentItem && promptSource && !grade) {
      speak(promptSource, speechLang(sourceLang));
      inputRef.current?.focus();
    }
    // On a card change, any read-aloud in progress
    // (e.g. the word + example sentence chain after Check) should stop (same pattern).
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.itemId, loading, sentenceOpen]);

  // Card-level resume: after every queue / batch change it saves a snapshot (lib/learnResume.ts).
  useEffect(() => {
    if (loading || !today) return;
    const base = batchBase.day === today && batchBase.level === level ? batchBase.n : null;
    void saveLearnResume(getDb(), buildLearnResume(queue, today, level, base));
  }, [loading, queue, today, level, batchBase]);

  const dueRemaining = queue.filter((c) => c.state !== 'new').length;
  const newRemaining = queue.filter((c) => c.state === 'new').length;
  const doneToday = countDoneToday([...allCards.values()], today);
  const xpToday = dailyXp.date === localDateString() ? wholeXp(dailyXp.xp) : 0;
  // The header shows WHAT today's introduction
  // consists of (word vs. sentence), plus today's total budget (limit + bonus).
  // The daily budget is DAILY, so "introduced today" counts across all levels: at the viewed level the live state
  // (allCards, updated by every grade), at the other levels the load-time state (allLevelCards).
  const cardsAllLevels = [...allCards.values(), ...allLevelCards.filter((c) => !allCards.has(c.itemId) && findPcicItem(c.itemId) !== undefined)];
  // The exam row's numbers are computed from the LIVE cards (the load-time state did not
  // include words learned during the session), so that "N to go" and "Practice words" mean the same number.
  const examRow = examLevels.map((loaded) => {
    const status: ExamLevelStatus = {
      ...loaded,
      ...examUnlock(loaded.level, pcicItemsForLevel(loaded.level).map((i) => i.id), cardsAllLevels, loaded.lessonDone),
    };
    return {
      status,
      onStart: () => closeSheetThen(() => router.push({ pathname: '/exam', params: { level: status.level } })),
      onPractice: () => handlePractice(status.level, status.missing),
      onGrammar: () => closeSheetThen(() => router.push('/(tabs)/course')),
    };
  });
  const introducedTodayByKind = countIntroducedTodayByKind(cardsAllLevels, today, (id) => findPcicItem(id)?.kind);
  const todayNewBudget = dailyNewLimit + pcicBonus;

  // The DB write + counters are here, the queue step (advance) is in the
  // caller handleGrade, separately.
  const commitGrade = async (g: Sm2Grade): Promise<Sm2Card | null> => {
    if (!current) return null;
    const wasNew = current.state === 'new';
    const before = { ...current };
    const next = sm2Review(current, g, today);
    await getDb().upsertPcicCard(next);
    // The daily streak is now written by PCIC grading (the
    // Learn tab, the only earlier caller, was removed); after the first call of the day the method is
    // a no-op, so it is safe on Again too.
    await getDb().updateStreak();
    // "Knew it" earns XP (new word 3, review 2; XP v2: lib/dailyXp.ts), "Didn't know" none.
    const points = xpForCard({ isNew: wasNew, isDue: !wasNew && before.due <= today, reviewCount: before.reps, knew: g !== 'again' }, { v2: xpV2 });
    const earned = points > 0 ? await addXp(points) : null;
    if (earned) setDailyXp(earned);

    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade, wasNew, g, counted: true, cadenceBefore: cadence, xp: earned ? { date: earned.date, points } : undefined });
    setSessionAnswered((n) => n + 1);
    if (wasNew) setSessionNew((n) => n + 1);
    if (g === 'again') setSessionAgain((n) => n + 1);
    return next;
  };

  // It also passes `grade` to requeue, so that only the "Didn't know"
  // (again) card gets a returnAt timer, and the "Knew it" (good) one does not.
  const advance = (next: Sm2Card, g: Sm2Grade) => {
    setQueue((prev) => requeueAfterGrade(prev, next, today, g, Date.now(), againDelaySec));
    setTypedAnswer('');
    setArticlePick('');
    setGrade(null);
    setCardSeq((n) => n + 1);
  };

  // After Check, after reading the word aloud, the example sentence
  // is also spoken automatically in a chain, if the item has one (exampleEs/exampleEn).
  // Both are spoken in the target language, not always Spanish.
  const speakRevealed = (best: string) => {
    const example = target === 'es' ? currentItem?.exampleEs : currentItem?.exampleEn;
    if (example) {
      speakSequence([
        { text: best, locale: speechLang(target) },
        { text: example, locale: speechLang(target) },
      ]);
    } else {
      speak(best, speechLang(target));
    }
  };

  const handleCheck = async () => {
    if (!current || !currentItem || !answerText) return;
    const answer = composeAnswer(articlePick, typedAnswer);
    if (answer.trim().length === 0) {
      // An empty submission also reveals the correct form and
      // reads it aloud, but does not grade automatically; the tap decides, as with
      // any reveal.
      const g = gradePcicAnswer('', answerText, strictAccents);
      const revealed: PcicGrade = { ...g, match: 'wrong', accentOnly: undefined };
      setGrade(revealed);
      if (revealed.match !== 'exact') setArticlePick(articleOf(revealed.best));
      speakRevealed(g.best);
      return;
    }
    // On reveal the correct target-language form is always spoken.
    // For a sentence item, an answer without the pronoun is also accepted.
    const g = (currentItem.kind === 'sentence' ? gradeSentenceAnswer : gradePcicAnswer)(answer, answerText, strictAccents);
    setTypedAnswer(answer);
    setGrade(g);
    if (g.match !== 'exact') setArticlePick(articleOf(g.best));
    speakRevealed(g.best);
  };

  const handleGrade = async (g: Sm2Grade) => {
    if (gradingRef.current) return;
    gradingRef.current = true;
    try {
      await gradeOnce(g);
    } finally {
      gradingRef.current = false;
    }
  };

  const gradeOnce = async (g: Sm2Grade) => {
    const wasNew = current?.state === 'new';
    const next = await commitGrade(g);
    if (!next) return;
    advance(next, g);
    // After every 4th NEW word a sentence card can come
    // (practice only, its result does not write SRS).
    if (!wasNew) return;
    // Beta "Sentences tab" on: the sentence cards live on that tab, none comes here.
    if (getBeta('sentenceTab')) return;
    const cardsById = new Map(allLevelCards.map((c) => [c.itemId, c]));
    for (const [id, c] of allCards) cardsById.set(id, c);
    cardsById.set(next.itemId, next);
    const step = nextSentenceStep(cadence, next.itemId, {
      target,
      cards: cardsById.values(),
      tenses,
      findItem: findPcicItem,
      vocab: () => pcicItemsForLevel(level).map((i) => (target === 'es' ? i.es : i.en)),
    });
    setCadence(step.state);
    setSentenceCard(step.card);
  };

  const handleUndo = async () => {
    if (!lastGraded) return;
    await getDb().upsertPcicCard(lastGraded.before);
    // Take the grade's XP back, so undo + grade again cannot farm it.
    if (lastGraded.xp) setDailyXp(await addXp(-lastGraded.xp.points, lastGraded.xp.date));
    setAllCards((prev) => new Map(prev).set(lastGraded.before.itemId, lastGraded.before));
    setQueue((prev) => requeueAfterUndo(prev, lastGraded.before, lastGraded.after, today));
    // The floor is 0 because it can be pressed during a session reset (load) too.
    if (lastGraded.counted) {
      setSessionAnswered((n) => Math.max(0, n - 1));
      if (lastGraded.wasNew) setSessionNew((n) => Math.max(0, n - 1));
      if (lastGraded.g === 'again') setSessionAgain((n) => Math.max(0, n - 1));
    }
    setTypedAnswer(lastGraded.typed);
    setArticlePick('');
    setGrade(lastGraded.grade);
    setLastGraded(null);
    setCadence(lastGraded.cadenceBefore);
    setSentenceCard(null);
  };

  const handleDontLearn = async () => {
    if (!current) return;
    const before = { ...current };
    const next = sm2MarkKnown(current, today);
    await getDb().upsertPcicCard(next);
    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade, wasNew: false, g: 'good', counted: false, cadenceBefore: cadence });
    setQueue((prev) => requeueAfterGrade(prev, next, today));
    setTypedAnswer('');
    setArticlePick('');
    setGrade(null);
    setCardSeq((n) => n + 1);
  };

  // Progress reset (the old 🗑️) moved to the Settings tab.

  // There are no more due/new cards, but the topic still has
  // items that have not been introduced; this expands the daily budget by +10 (persisted,
  // expires with the calendar day) and rebuilds the queue.
  const handleMoreNew = (step: number = PCIC_NEW_BONUS_STEP) => {
    const activeCards = [...allCards.values()];
    const introducedToday = activeCards.filter((c) => c.introducedAt === today).length;
    const introducedAllLevels = cardsAllLevels.filter((c) => c.introducedAt === today).length;
    const next = nextPcicNewBonus({ limit: dailyNewLimit, bonus: pcicBonus, introducedToday: introducedAllLevels }, step);
    setPcicBonus(next);
    setBatchBase({ day: today, level, n: countFinishedToday(activeCards, queue, today) });
    getDb().setPcicNewBonus(next, today).catch(() => {
      // the bonus is already in state; a failed write only means it is not remembered
    });
    setQueue(
      pickSm2Session(
        activeCards,
        pcicIntroOrder(newOrder),
        today,
        pcicSessionNewLimit({ limit: dailyNewLimit, bonus: next, introducedAllLevels, introducedThisLevel: introducedToday })
      )
    );
  };

  // The exam row's "Practice words" button. If today's budget is used up, it expands from the missing
  // words shown in the row (lib/pcicSession.ts practiceTopUpStep), and the new batch's progress bar starts at 0%;
  // otherwise it just switches level, as before.
  const handlePractice = async (lvl: PcicLevel, missing: number) => {
    const introducedAllLevels = cardsAllLevels.filter((c) => c.introducedAt === today).length;
    const step = practiceTopUpStep({ limit: dailyNewLimit, bonus: pcicBonus, introducedAllLevels, missing });
    if (step === 0) return handleSelectLevel(lvl);
    setLevelSheetOpen(false);
    const db = getDb();
    await db.setPcicNewBonus(nextPcicNewBonus({ limit: dailyNewLimit, bonus: pcicBonus, introducedToday: introducedAllLevels }, step), today);
    if (lvl !== level) await db.setPcicLevel(lvl);
    const levelCards = lvl === level ? [...allCards.values()] : cardsForLevel(allLevelCards, lvl);
    setLoading(true);
    await load(lvl);
    setBatchBase({ day: today, level: lvl, n: countDoneToday(levelCards, today) });
  };

  return {
    loading,
    level,
    setLevelSheetOpen,
    newOrder,
    dueRemaining,
    newRemaining,
    doneToday,
    xpToday,
    lastGraded,
    handleUndo,
    introducedTodayByKind,
    todayNewBudget,
    sentenceCard,
    setSentenceCard,
    levelSheetOpen,
    allLevelCards,
    target,
    examRow,
    openPlacement,
    handleSelectLevel,
    sourceLang,
    strictAccents,
    dockLift,
    kbHeight,
    dockH,
    setDockH,
    languagePair,
    current,
    currentItem,
    allCards,
    sessionAnswered,
    sessionNew,
    sessionAgain,
    handleMoreNew,
    queue,
    today,
    batchBase,
    answerText,
    promptSource,
    noteOpenFor,
    setNoteOpenFor,
    grade,
    articlePick,
    setArticlePick,
    typedAnswer,
    setTypedAnswer,
    cardSeq,
    inputRef,
    handleCheck,
    handleGrade,
    handleDontLearn,
  };
}
