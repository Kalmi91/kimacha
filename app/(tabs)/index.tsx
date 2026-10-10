import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { Text } from '@/components/KText';
import { router, useFocusEffect } from 'expo-router';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { localDateString, DEFAULT_DAILY_NEW_LIMIT } from '@/lib/usageStats';
import { addXp, xpForGrade, DAILY_XP_GOAL, type DailyXp } from '@/lib/dailyXp';
import { pcicItemsForLevel, findPcicItem, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade, type PcicGrade } from '@/lib/pcicMatch';
import {
  ARTICLE_OPTIONS,
  articleOf,
  articlePickerApplies,
  articleRowAppliesForPos,
  composeAnswer,
  type ArticlePick,
} from '@/lib/articlePicker';
import { sm2Review, pickSm2Session, sm2MarkKnown, LEARNING_STEPS, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { countDoneToday, countIntroducedTodayByKind, requeueAfterGrade, requeueAfterUndo, DEFAULT_AGAIN_DELAY_SEC, nextPcicNewBonus, pcicSessionNewLimit, practiceTopUpStep, PCIC_NEW_BONUS_STEP, PCIC_NEW_BONUS_STEPS, thinSentences, dropOrphanCards, countFinishedToday, dayProgressPercent, finishedInBatch } from '@/lib/pcicSession';
import { cardsForLevel } from '@/lib/pcicLevels';
import { applyLearnResume, buildLearnResume, isLearnResumeFor, loadLearnResume, saveLearnResume } from '@/lib/learnResume';
import { posOf } from '@/lib/pcicPos';
import FeedbackButton from '@/components/FeedbackModal';
import SpeakButton from '@/components/SpeakButton';
import BadgeRow from '@/components/learn/BadgeRow';
import CardShell from '@/components/learn/CardShell';
import CardNote from '@/components/learn/CardNote';
import { SkinBackdrop, SkinHeader, SkinSpeakLabel, SkinWord } from '@/components/skins/Slots';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import PcicRevealedAnswer from '@/components/learn/PcicRevealedAnswer';
import MistakesEntry from '@/components/learn/MistakesEntry';
import { answerInputProps } from '@/lib/inputProps';
import LevelPickerSheet from '@/components/LevelPickerSheet';
import { BrutalBox, BrutalButton, SegmentBar, brutalInputStyle, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import EasySentenceCard from '@/components/EasySentenceCard';
import FitText from '@/components/FitText';
import DoneBadge from '@/components/DoneBadge';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { resolvedTensesFromLessons, type ResolvedTense } from '@/lib/knownSentence';
import { INITIAL_CADENCE, nextSentenceStep, type CadenceState, type SentenceCardData } from '@/lib/sentenceCards';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { examStatusFor, examUnlock, levelHasLesson, type ExamLevelStatus } from '@/lib/exam/unlock';

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

export default function PcicScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

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
  const { dockLift } = useDockLift();
  // The input field gets focus on every NEW card (see the
  // effect below), not only on first mount (the `autoFocus` prop is not
  // enough for this, because the TextInput does not remount on a card change).
  const inputRef = useRef<TextInput>(null);
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
    setDailyXp({ date: day, xp: await db.getDailyXp(day) });
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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

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
  const languagePair = target === 'es' ? 'en-es' : 'es-en';

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
  const xpToday = dailyXp.date === localDateString() ? dailyXp.xp : 0;
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
    // "Knew it" earns XP (new word 3, review 2), "Didn't know" none.
    const points = xpForGrade(wasNew, g);
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
    const wasNew = current?.state === 'new';
    const next = await commitGrade(g);
    if (!next) return;
    advance(next, g);
    // After every 4th NEW word a sentence card can come
    // (practice only, its result does not write SRS).
    if (!wasNew) return;
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
    getDb().setPcicNewBonus(next, today).catch(() => {});
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

  // The header's FIRST chip is the selected level,
  // tapping it opens the level picker sheet; the existing four chips are unchanged.
  // A BadgeRow chip row instead of the old single-line text header (`s.pcic.header`);
  // the four numbers are the same, just from separate i18n keys (badgeTotal/Due/New/Done).
  // The "My mistakes" entry is a standalone component (with its own
  // loading) so that this file (785 lines) does not grow past 800; it only
  // renders if there is a loaded bundle.

  const headerRow = (
    <SkinHeader>
    <View style={styles.headerRow}>
      <View style={styles.headerBadges}>
        {g.brutal ? (
          // The level chip box (active = filled).
          <BrutalBox testID="learn-level-chip" fill="a" offset={2} boxStyle={styles.brutalLevelChip} onPress={() => setLevelSheetOpen(true)}>
            <Text style={[styles.levelChipText, { color: g.onFill, fontWeight: '500' }]}>{level} ▾</Text>
          </BrutalBox>
        ) : (
          <Pressable style={[styles.levelChip, { backgroundColor: colors.tint }]} onPress={() => setLevelSheetOpen(true)}>
            <Text style={[styles.levelChipText, { color: colors.onTint }]}>{level} ▾</Text>
          </Pressable>
        )}
        <BadgeRow
          colors={colors}
          items={[
            { label: s.pcic.badgeTotal(newOrder.length) },
            { label: s.pcic.badgeDue(dueRemaining), tone: 'blue' },
            { label: s.pcic.badgeNew(newRemaining), tone: 'green' },
            { label: s.pcic.badgeDone(doneToday) },
            { label: s.pcic.badgeXp(xpToday, DAILY_XP_GOAL), tone: 'accent', accessibilityLabel: s.pcic.badgeXpA11y(xpToday, DAILY_XP_GOAL), tabular: true },
          ]}
        />
      </View>
      <View style={styles.headerIcons}>
        {lastGraded && (
          <Pressable onPress={handleUndo} hitSlop={12} style={styles.resetBtn} accessibilityLabel={s.pcic.undo}>
            <Text style={styles.resetIcon}>↶</Text>
          </Pressable>
        )}
      </View>
    </View>
    {/* fix: the old fifth BadgeRow chip (what today's introduction consists of
        + today's total budget) was one long, continuous text that stuck out
        of the screen's right edge as a chip (it did not fit in the row, and the chip's interior
        cannot wrap). It became a separate, full-width, wrappable row
        BELOW the chip row; the content (i18n) is unchanged. */}
    <Text style={[styles.todayLine, { color: colors.tabIconDefault }]}>
      {s.pcic.badgeIntroducedToday(introducedTodayByKind.words, introducedTodayByKind.sentences, todayNewBudget)}
    </Text>
    <MistakesEntry colors={colors} />
    </SkinHeader>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // The sentence card comes before the next word card
  // (before the done screen too). Its own button closes it; it does not write SRS.
  if (sentenceCard) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SkinBackdrop />
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
          exam={examRow}
          onPlacement={openPlacement}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        {sentenceCard.kind === 'tiles' ? (
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={[styles.cardScrollContent, { paddingBottom: g.brutal ? 100 : 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <EasySentenceCard
              key={sentenceCard.itemId}
              sourceSentence={sentenceCard.source}
              targetWords={sentenceCard.targetWords}
              trapWords={sentenceCard.trapWords}
              speechLocale={speechLang(target)}
              sourceSpeechLocale={speechLang(sourceLang)}
              onResult={() => setSentenceCard(null)}
              gradeButtons
            />
          </ScrollView>
        ) : (
          // The typing sentence card has its own scroller + the docked Check bar above the
          // keyboard (like on the word card), so there is no outer ScrollView.
          <TypedSentenceCard
            key={sentenceCard.itemId}
            sourceSentence={sentenceCard.source}
            targetSentence={sentenceCard.target}
            strictAccents={strictAccents}
            speechLocale={speechLang(target)}
            sourceSpeechLocale={speechLang(sourceLang)}
            onResult={() => setSentenceCard(null)}
            dockLift={dockLift}
            dockH={dockH}
            onDockHeight={setDockH}
            gradeButtons
          />
        )}
        <FeedbackButton
          level={level}
          languagePair={languagePair}
          currentCard={`sentence:${sentenceCard.itemId}`}
          bottomOffset={sentenceCard.kind === 'tiles' ? undefined : dockH + dockLift}
        />
      </KeyboardAvoidingView>
    );
  }

  if (!current || !currentItem) {
    // How many PCIC items are already introduced (not in 'new' state) in the whole
    // list, for the done screen's own progress bar.
    const introducedCount = [...allCards.values()].filter((c) => c.state !== 'new').length;
    const introducedPct = newOrder.length > 0 ? (introducedCount / newOrder.length) * 100 : 0;
    return (
      <View style={[styles.container, styles.doneContainer, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
          exam={examRow}
          onPlacement={openPlacement}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        <View style={styles.doneHeader}>
          {/* drawn badge (check mark + confetti) instead of the 🎉 emoji, in the neo-brutalist style. */}
          <DoneBadge />
          <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.pcic.doneTitle}</Text>
        </View>
        {g.brutal ? (
          <View style={styles.tilesRow}>
            {([['b', sessionAnswered, s.pcic.tileAnswered], ['paper', sessionNew, s.pcic.tileNew], ['a', sessionAgain, s.pcic.tileAgain]] as const).map(([fill, n, label]) => (
              <BrutalBox key={label} testID="learn-done-tile" fill={fill} style={styles.brutalTile} boxStyle={styles.brutalTileBox}>
                <Text style={[styles.tileNumber, { color: textOnFill(g, fill), fontWeight: '500' }]}>{n}</Text>
                <Text style={[styles.tileLabel, { color: textOnFill(g, fill) }]}>{label}</Text>
              </BrutalBox>
            ))}
          </View>
        ) : (
        <View style={styles.tilesRow}>
          <View style={[styles.tile, { backgroundColor: '#38BDF8' }]}>
            <Text style={styles.tileNumber}>{sessionAnswered}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAnswered}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: '#22C55E' }]}>
            <Text style={styles.tileNumber}>{sessionNew}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileNew}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: '#F472B6' }]}>
            <Text style={styles.tileNumber}>{sessionAgain}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAgain}</Text>
          </View>
        </View>
        )}
        <View style={styles.introducedBlock}>
          <Text style={[styles.introducedLabel, { color: colors.tabIconDefault }]}>
            {s.pcic.introduced(introducedCount, newOrder.length)}
          </Text>
          {g.brutal ? (
            <SegmentBar filled={segmentsFilled(introducedPct, 8)} segments={8} />
          ) : (
            <View style={[styles.introducedTrack, { backgroundColor: colors.card }]}>
              <View style={[styles.introducedFill, { backgroundColor: '#38BDF8', width: `${introducedPct}%` }]} />
            </View>
          )}
        </View>
        {newOrder.some((id) => !allCards.has(id) || allCards.get(id)!.state === 'new') && (
          // +5 / +10 / +15 new words, in one row (the +10 testID is unchanged: learn-more-new).
          <View style={styles.moreNewBlock}>
            <Text style={[styles.moreNewHint, { color: colors.tabIconDefault }]}>{s.pcic.moreNewHint}</Text>
            <View style={styles.moreNewRow}>
              {PCIC_NEW_BONUS_STEPS.map((n) => {
                const testID = n === PCIC_NEW_BONUS_STEP ? 'learn-more-new' : `learn-more-new-${n}`;
                return g.brutal ? (
                  <BrutalButton key={n} testID={testID} accessibilityLabel={s.pcic.moreNew(n)} label={s.pcic.moreNewShort(n)} onPress={() => handleMoreNew(n)} style={styles.moreNewBtn} />
                ) : (
                  <Pressable key={n} testID={testID} accessibilityRole="button" accessibilityLabel={s.pcic.moreNew(n)} style={[styles.checkBtn, styles.moreNewBtn, { backgroundColor: '#38BDF8' }]} onPress={() => handleMoreNew(n)}>
                    <Text style={styles.checkBtnText}>{s.pcic.moreNewShort(n)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <FeedbackButton level={level} languagePair={languagePair} currentCard="pcic" />
      </View>
    );
  }

  // The progress bar under the header is built from the persisted `doneToday`
  // daily count (not from `sessionAnswered`, which resets on every mount), so that
  // it shows the real daily progress after a tab switch or an app restart,
  // and does not jump back to empty.
  // The bar shows what remains of TODAY's batch (empty at the first
  // card, full at the last, it does not restart mid-batch; lib/pcicSession.ts
  // dayProgressPercent). The earlier measurement by sets of 10 restarted at every 10th card.
  // After +N it shows the progress of the new batch (finishedInBatch), not the day's total.
  const barPct = dayProgressPercent(
    finishedInBatch(countFinishedToday([...allCards.values()], queue, today), batchBase.day === today && batchBase.level === level ? batchBase.n : 0),
    queue.length
  );

  // The page/step badge placed at the top of the card (CardShell's chip prop),
  // in place of the earlier stepBadge texts in sectionRow.
  const chipLabel =
    current.state === 'new'
      ? s.pcic.newBadge
      : current.state === 'learning' && LEARNING_STEPS > 1
        ? s.pcic.learningStep(current.step + 1, LEARNING_STEPS)
        : undefined;

  // Part-of-speech chip under the word, from the Spanish form (lib/pcicPos.ts).
  // posOf runs only for es as the target language (the
  // rule/corpus is built on Spanish word forms, it makes no sense for English as the target).
  const pos = target === 'es' ? posOf(currentItem) : null;

  const hasNote = !!currentItem.note || !!currentItem.image;
  const noteOpen = hasNote && noteOpenFor === currentItem.id;

  // The docked Check bar switches to "Next" after reveal,
  // in the same place/size, with the suggested grade in the label.
  const nextGrade = grade ? suggestedGrade(grade) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SkinBackdrop />
      {headerRow}
      <LevelPickerSheet
        visible={levelSheetOpen}
        active={level}
        cards={allLevelCards}
        colors={colors}
        title={s.pcic.chooseLevel}
        target={target}
        exam={examRow}
        onPlacement={openPlacement}
        onSelect={handleSelectLevel}
        onClose={() => setLevelSheetOpen(false)}
      />

      {g.brutal ? (
        <SegmentBar testID="learn-progress" filled={segmentsFilled(barPct, 8)} segments={8} style={styles.brutalProgress} />
      ) : (
        <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
          <View testID="learn-progress-fill" style={[styles.progressFill, { backgroundColor: colors.tint, width: `${barPct}%` }]} />
        </View>
      )}

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: FAB_CLEARANCE + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell
          compact
          colors={colors}
          chip={chipLabel}
          chipTone={current.state === 'new' ? 'new' : 'neutral'}
          onPress={() => Keyboard.dismiss()}
        >
          {/* the 🔊 next to the word speaks the English again (added afterwards),
              with the same call as the read-aloud on opening a card. */}
          <View style={styles.wordRow}>
            {/* a long word / sentence ("reason (justification)", "they are
                going to arrive") with a font size that depends on its length and a shrinking width;
                without this the native row extended beyond the card and its left edge was clipped. */}
            <SkinWord word={promptSource ?? ''} lang={sourceLang}>
              <FitText variant="word" base={32} maxLines={3} reserve={150} style={[styles.frontText, { color: colors.text }]}>
                {promptSource ?? ''}
              </FitText>
            </SkinWord>
            {/* the senior theme puts a text label under the 🔊 (SkinSpeakLabel). */}
            <View style={{ alignItems: 'center' }}>
              <SpeakButton onPress={() => speak(promptSource ?? '', speechLang(sourceLang))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
              <SkinSpeakLabel />
            </View>
          </View>
          {/* a short sentence under the word when the question has several
              meanings; the part marked `*…*` is bold + pink underline, the asterisks are not
              visible. It stays while typing and after Check; the read-aloud does not change. */}
          {currentItem.hint && (
            <Text testID="learn-hint" style={[styles.hintText, { color: colors.tabIconDefault }]}>
              {currentItem.hint.split('*').map((part, i) =>
                i % 2 === 1 ? (
                  <Text key={i} style={[styles.hintMark, { color: colors.text }]}>{part}</Text>
                ) : (
                  part
                )
              )}
            </Text>
          )}
          {/* the chip (part of speech) + the section appear in the same row
              while typing and after reveal, so that the item can be told apart even with an English
              prompt that repeats three times. */}
          <View style={styles.sectionRow}>
            {pos && (
              <View style={[styles.posChip, { backgroundColor: colors.background }, g.brutal && [styles.brutalPos, { borderColor: g.ink }]]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>
                  {pos.gender ? `${s.pos[pos.pos]} · ${pos.gender}` : s.pos[pos.pos]}
                </Text>
              </View>
            )}
            <Text style={[styles.sectionText, { color: colors.tabIconDefault }]}>{currentItem.section}</Text>
            {/* (i) only on a card with an explanation; tapping toggles the
                card's `note` below the chip row (it does not cover the Check bar or the 💬). */}
            {hasNote &&
              (g.brutal ? (
                <BrutalBox testID="learn-info" accessibilityLabel={s.pcic.noteLabel} fill={noteOpen ? 'b' : 'paper'} offset={2} boxStyle={styles.infoBtn} onPress={() => setNoteOpenFor(noteOpen ? null : currentItem.id)}>
                  <Text style={[styles.infoBtnText, { color: noteOpen ? g.onB : g.ink }]}>i</Text>
                </BrutalBox>
              ) : (
                <Pressable
                  testID="learn-info"
                  accessibilityRole="button"
                  accessibilityLabel={s.pcic.noteLabel}
                  accessibilityState={{ expanded: noteOpen }}
                  hitSlop={8}
                  onPress={() => setNoteOpenFor(noteOpen ? null : currentItem.id)}
                  style={[styles.infoBtn, { borderColor: colors.tint, backgroundColor: noteOpen ? colors.tint : 'transparent' }]}
                >
                  <Text style={[styles.infoBtnText, { color: noteOpen ? colors.background : colors.tint }]}>i</Text>
                </Pressable>
              ))}
          </View>
          {noteOpen && <CardNote note={currentItem.note} image={currentItem.image} colors={colors} />}

          {/* article button row from the Learn tab, ⊘ is the default.
              Addition: on PCIC the chip already shows when it is not a noun, so the
              row appears only for noun/unknown part of speech (lib/articlePicker.ts).
              It appears only for es as the target language. */}
          {target === 'es' &&
            articlePickerApplies(target, currentItem.kind !== 'sentence', answerText) &&
            articleRowAppliesForPos(pos) && (
            <View style={styles.articleRow}>
              {([...ARTICLE_OPTIONS, ''] as ArticlePick[]).map((opt) => {
                const active = articlePick === opt;
                if (g.brutal) {
                  return (
                    <BrutalBox
                      key={opt || 'none'}
                      fill={active ? 'a' : 'paper'}
                      offset={2}
                      disabled={!!grade}
                      onPress={() => setArticlePick(active ? '' : opt)}
                      style={grade ? styles.brutalDim : undefined}
                      boxStyle={styles.brutalArticle}
                      accessibilityLabel={opt || 'sin artículo'}
                    >
                      <Text style={[styles.articleChipText, { color: active ? g.onFill : g.ink, fontWeight: '500' }]}>{opt || '⊘'}</Text>
                    </BrutalBox>
                  );
                }
                return (
                  <Pressable
                    key={opt || 'none'}
                    disabled={!!grade}
                    onPress={() => setArticlePick(active ? '' : opt)}
                    style={[
                      styles.articleChip,
                      { backgroundColor: active ? colors.tint : colors.background, opacity: grade ? 0.6 : 1 },
                    ]}
                    accessibilityLabel={opt || 'sin artículo'}
                  >
                    <Text style={[styles.articleChipText, { color: active ? colors.background : colors.text }]}>
                      {opt || '⊘'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <TextInput
            key={`pcic-in-${current.itemId}-${cardSeq}`}
            ref={inputRef}
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, g.brutal && brutalInputStyle(g)]}
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            onSubmitEditing={grade ? () => nextGrade && handleGrade(nextGrade) : handleCheck}
            editable={!grade}
            autoFocus={!grade}
            placeholder={s.card.typeIn(target)}
            placeholderTextColor={colors.tabIconDefault}
            {...answerInputProps}
          />

          {grade && (
            <PcicRevealedAnswer
              colors={colors}
              s={s}
              typedAnswer={typedAnswer}
              grade={grade}
              nextGrade={nextGrade}
              current={current}
              currentItem={currentItem}
              today={today}
              target={target}
              onGrade={handleGrade}
            />
          )}

          <View style={styles.bottomRow}>
            <Pressable onPress={handleDontLearn} hitSlop={8}>
              <Text style={[styles.dontLearn, { color: colors.tabIconDefault }]}>{s.pcic.dontLearn}</Text>
            </Pressable>
          </View>
        </CardShell>
      </ScrollView>

      {/* After Check, the SAME docked bar (place+size
          unchanged) switches to "Next", its label states the suggested grade;
          the two buttons in the card remain for override. */}
      <DockedAction
        label={grade && nextGrade ? s.pcic.next(s.pcic[nextGrade]) : `✓ ${s.card.check}`}
        onPress={grade && nextGrade ? () => handleGrade(nextGrade) : handleCheck}
        tone={grade ? 'next' : 'check'}
        color={grade ? '#22C55E' : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />

      <FeedbackButton level={level} languagePair={languagePair} currentCard={`pcic:${current.itemId}`} bottomOffset={dockH + dockLift} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  // The loading branch also uses the shared container, but the spinner
  // must stay in the center, not jump to the top.
  centered: {
    justifyContent: 'center',
  },
  // thin progress bar under the header, on the learning view.
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  // the level chip + the existing four BadgeRow chips in one row.
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brutalLevelChip: { paddingHorizontal: 10, paddingVertical: 3 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalTile: { flex: 1 },
  brutalTileBox: { paddingVertical: 12, alignItems: 'center' },
  // the three "+N new words" buttons in one row.
  moreNewBlock: { gap: 4 },
  moreNewHint: { fontSize: 13, textAlign: 'center' },
  moreNewRow: { flexDirection: 'row', gap: 10 },
  moreNewBtn: { flex: 1, width: 'auto', marginTop: 0 },
  brutalProgress: { marginBottom: 16 },
  brutalArticle: { minWidth: 48, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  brutalDim: { opacity: 0.6 },
  brutalPos: { borderWidth: 2, borderRadius: 0 },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // fix: today's word/sentence breakdown is its own full-width,
  // wrappable row under the chip row (see the Text after headerRow).
  todayLine: {
    fontSize: 12,
    marginBottom: 8,
  },
  resetBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  // colorful done screen, in the visual language of components/DoneScreen.tsx
  // (doneEmoji, statsGrid), but with its own styles.
  doneContainer: {
    gap: 16,
  },
  doneHeader: {
    alignItems: 'center',
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tileNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
  },
  introducedBlock: {
    alignSelf: 'stretch',
  },
  introducedLabel: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  introducedTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  introducedFill: {
    height: '100%',
    borderRadius: 5,
  },
  // the card box moved into CardShell, and the scroller keeps the docked
  // bar's height at the bottom (cardScroll/cardScrollContent).
  cardScroll: {
    flex: 1,
    width: '100%',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  // the word row (word + 🔊), at the top of CardShell.
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // took over Learn's frontText size (32/bold), so that the cards of the two tabs
  // show a word of equal weight.
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  // text of the ℹ️ note, under the wordRow.
  // A short sentence (hint) under the big word.
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  hintMark: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: '#EC4899',
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 12,
    textAlign: 'center',
    flexShrink: 1,
  },
  // the (i) button in the chip row, and the card's explanation below it.
  infoBtn: {
    minWidth: 24,
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  // part-of-speech chip (noun/verb/phrase) next to the section text.
  posChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  posChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  speakBtn: {
    padding: 4,
    flexShrink: 0,
  },
  speakIcon: {
    fontSize: 22,
  },
  articleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  articleChip: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  articleChipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  dontLearn: {
    fontSize: 13,
    textAlign: 'right',
  },
  // The "Don't learn this" row; flex-end puts dontLearn at
  // the old right-aligned place.
  // marginTop: 10 instead of the earlier marginBottom: 8 (the box height is about the same), so that the row does not
  // touch the input field (there was an overlap on themes with a wider row height / rotated card frame).
  // If the two labels do not fit in one row (wide font: dyslexia), the second wraps onto a new row
  // instead of hanging out to the left of the card (because of flex-end the start of the filled row was cut off).
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    rowGap: 4,
    marginTop: 10,
  },
  checkBtn: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
