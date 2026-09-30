import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { localDateString, DEFAULT_DAILY_NEW_LIMIT } from '@/lib/usageStats';
import { pcicItemsForViewLevel, findPcicItem, realLevelOfView, setPcicTarget, type PcicViewLevel, type PcicTarget } from '@/data/pcic';
import { gradePcicAnswer, suggestedGrade, type PcicGrade } from '@/lib/pcicMatch';
import {
  ARTICLE_OPTIONS,
  articleOf,
  articlePickerApplies,
  articleRowAppliesForPos,
  composeAnswer,
  type ArticlePick,
} from '@/lib/articlePicker';
import { sm2Review, pickSm2Session, sm2MarkKnown, LEARNING_STEPS, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { countDoneToday, countIntroducedTodayByKind, requeueAfterGrade, requeueAfterUndo, DEFAULT_AGAIN_DELAY_SEC, nextPcicNewBonus, pcicNewBudget, thinSentences, dropOrphanCards } from '@/lib/pcicSession';
import { applyChainOrder, chainGroupId } from '@/lib/pcicChains';
import { cardsForViewLevel } from '@/lib/pcicLevels';
import { posOf } from '@/lib/pcicPos';
import { pcicNoteText } from '@/lib/pcicNotes';
import { sensesFor } from '@/lib/pcicSenses';
import FeedbackButton from '@/components/FeedbackModal';
import BadgeRow from '@/components/learn/BadgeRow';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import PcicRevealedAnswer from '@/components/learn/PcicRevealedAnswer';
import MistakesEntry from '@/components/learn/MistakesEntry';
import { answerInputProps } from '@/lib/inputProps';
import LevelPickerSheet from '@/components/LevelPickerSheet';
import { BrutalBox, BrutalButton, SegmentBar, brutalInputStyle, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import EasySentenceCard from '@/components/EasySentenceCard';
import FitText from '@/components/FitText';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { resolvedTensesFromLessons, type ResolvedTense } from '@/lib/knownSentence';
import { INITIAL_CADENCE, nextSentenceStep, type CadenceState, type SentenceCardData } from '@/lib/sentenceCards';

// PLAN-pcic 5. lépés: a PCIC fül. Angol -> spanyol gépelés, Anki-gombokkal
// (again/hard/good/easy), az önálló SM-2 ütemezőn (lib/sm2.ts, 4. lépés).
// Nem a FSRS `cards`/`sessionQueue` ütemezőt használja, azt nem érinti.

// PLAN-fb0924 8. lépés (FB394/396): a lánc-átrendezés (applyChainOrder) UTÁN a
// mondat-ritkítás (thinSentences) - de csak NORMÁL szinten; az "A1+"/"A2+"
// nézet kizárólag mondatból áll, ott a ritkítás mindent kidobna.
function pcicIntroOrder(memberIds: string[], cards: Sm2Card[], view: PcicViewLevel): string[] {
  const reordered = applyChainOrder(memberIds, cards, realLevelOfView(view));
  if (view === 'A1+' || view === 'A2+') return reordered;
  return thinSentences(reordered, (id) => findPcicItem(id)?.kind, (id) => chainGroupId(id) ?? id);
}

// SZ2 (SZAVAK.md): egy visszavonható értékelés pillanatképe. `counted` = a
// számlálókat is léptette-e (SZ3 „Ezt nem tanulom" gombja majd false-t ír ide).
interface UndoEntry {
  before: Sm2Card;
  after: Sm2Card;
  typed: string;
  grade: PcicGrade | null;
  wasNew: boolean;
  g: Sm2Grade;
  counted: boolean;
  // PLAN-ketiranyu 7. lépés: a mondatkártya-kadencia az értékelés előtti állapotban.
  cadenceBefore: CadenceState;
}

export default function PcicScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [level, setLevel] = useState<PcicViewLevel>('B1');
  // PLAN-ketiranyu 4. lépés: az aktív pár célnyelve (onboarding.target),
  // ez dönti el a kártya prompt/válasz irányát, a TTS locale-t és a
  // névelő-gombsor/posOf megjelenését.
  const [target, setTarget] = useState<PcicTarget>('es');
  // s1 (anki-ui-terv.html): a szint-választó lap; a benne mutatott N/total
  // haladáshoz MIND a négy szint kártyája kell, nem csak az aktívé.
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [allLevelCards, setAllLevelCards] = useState<Sm2Card[]>([]);
  // s2 (anki-ui-terv.html): a Beállítások ékezet-szigor kapcsolója a PCIC
  // gépelésén is dönt (gradePcicAnswer strictAccents paramja).
  const [strictAccents, setStrictAccents] = useState(false);
  // FB364 (PLAN-fb0923 5. lépés/D2): a Beállítások "Missed word comes back
  // after" steppere; a requeueAfterGrade "again" ágának a returnAt-ját adja.
  const [againDelaySec, setAgainDelaySec] = useState(DEFAULT_AGAIN_DELAY_SEC);
  const [allCards, setAllCards] = useState<Map<string, Sm2Card>>(new Map());
  const [queue, setQueue] = useState<Sm2Card[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [articlePick, setArticlePick] = useState<ArticlePick>('');
  const [grade, setGrade] = useState<PcicGrade | null>(null);
  // FB392/393: a ℹ️ jegyzet ki/be nyitása. Az itemId-t tárolja (nem egy
  // puszta boolean-t), hogy kártyaváltáskor a becsukódás LEVEZETETT állapot
  // legyen (nincs szükség rá, hogy egy effekt setState-tel nullázza -
  // react-hooks/set-state-in-effect).
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [sessionAgain, setSessionAgain] = useState(0);
  const [lastGraded, setLastGraded] = useState<UndoEntry | null>(null);
  // PLAN-ketiranyu 7. lépés: minden 4. új szó után 1 mondatkártya (felváltva
  // összerakós és begépelős), csak gyakorlás: nem ír SRS-t (K3). A `tenses` a
  // kész nyelvtani leckékkel feloldott igeidők (lib/knownSentence.ts).
  const [cadence, setCadence] = useState<CadenceState>(INITIAL_CADENCE);
  const [sentenceCard, setSentenceCard] = useState<SentenceCardData | null>(null);
  const [tenses, setTenses] = useState<ReadonlySet<ResolvedTense>>(new Set());
  // FB385/386: a "+10 új szó" gombbal bővített napi keret, a
  // learn_settings.new_bonus/new_bonus_date oszlopokban perzisztálva (a
  // naptári nappal lejár); load() a DB-ből olvassa vissza, nem nullázza.
  const [pcicBonus, setPcicBonus] = useState(0);
  // PLAN-play 12. lépés (C): a Beállítások "Napi új szó" (learn_settings.daily_new_limit,
  // eddig csak a törölt Tanulás fül olvasta) mostantól a PCIC napi új tételeinek
  // számát is adja; a fejléc "new" chipje ebből számol (queue state === 'new').
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);
  // PLAN-play 12. lépés (s3): a helyesírás-listán már szereplő PCIC-tételek
  // id-je, hogy a "Add to spelling" gomb "✓ In spelling list"-re váltson.
  const [pcicSpellingIds, setPcicSpellingIds] = useState<Set<string>>(new Set());
  // 5b: a dokkolt Check/Next sáv mért magassága, a görgető alsó paddingjéhez
  // és a 💬 bottomOffsetjéhez (DockedAction.tsx, a Learn DOCK_RESERVE-je az alapérték).
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  // FB350: a dokkolt sáv a billentyűzet fölé emelkedjen, mint a Learn fülön.
  const { dockLift } = useDockLift();
  // FB391: a beviteli mező fókuszt kap minden ÚJ lapnál (lásd a FB319
  // effektet lent), nem csak első mountkor (az `autoFocus` prop erre nem
  // elég, mert a TextInput kártyaváltáskor nem remountol).
  const inputRef = useRef<TextInput>(null);
  // FB408/FB409 (PLAN-fb0929 2. lépés): a beviteli mező minden új kártyánál
  // ÚJRA MOUNTOL (a TextInput `key`-e ezt a számlálót tartalmazza). Ok: a mező
  // Check után `editable={false}` lett, majd Next után újra szerkeszthető, ugyanazon
  // a natív EditText-en. Androidon a letiltott-majd-engedélyezett mezőnek a
  // régi InputConnection / gépelési (composing) állapota megmarad: a `focus()`
  // néha nem nyitja fel a billentyűzetet (FB408), és a Gboard szerint még
  // "írás közben" lévő szövegből a törlés nem megy (FB409). Friss mező =
  // friss InputConnection + `autoFocus`, ami minden mountnál felnyitja a
  // billentyűzetet. A számláló azt is lefedi, ha ugyanaz a lap jön újra (again).
  const [cardSeq, setCardSeq] = useState(0);

  // PLAN-play 10. lépés: `overrideLevel` a szint-választó lapról jövő azonnali
  // váltásnak, hogy ne kelljen a setLevel-re várni egy render-kört (a db-be
  // már ott az új szint, load() csak újraolvassa vele).
  const load = useCallback(async (overrideLevel?: PcicViewLevel) => {
    const db = getDb();
    const day = localDateString();
    // PLAN-ketiranyu 4. lépés: az aktív pár célnyelve dönti el, melyik irány
    // paklija épül (data/pcic.ts setPcicTarget); a pcicItemsForViewLevel
    // hívás ELŐTT kell, különben a régi irány szavai jönnének.
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    setPcicTarget(dir);
    setTarget(dir);
    // PLAN-ketiranyu 4. lépés javítás (2026-09-28 review, 2. pont): ha
    // az aktív párnak MÉG nincs kifejezetten választott szintje (Settings
    // irányváltás egy korábban nem onboardolt irányra; friss onboarding
    // mindig választat, ide sose ér el választatlanul), a szint-választó lap
    // magától felnyílik, ugyanaz a lap, mint a fejléc-chipre koppintva.
    if (!overrideLevel && !(await db.hasPcicLevel())) setLevelSheetOpen(true);
    const lvl = overrideLevel ?? (await db.getPcicLevel());
    const newOrder = pcicItemsForViewLevel(lvl).map((i) => i.id);
    const rawCards = await db.getPcicCards();
    // PLAN-ketiranyu 2. lépés: a régi PCIC-korpusz árva SRS-sorait (a
    // betöltött korpuszban már nem létező item-id) kihagyja, mielőtt a
    // session belőlük épülne.
    const cards = dropOrphanCards(cardsForViewLevel(rawCards, lvl), (id) => findPcicItem(id) !== undefined);
    const strict = await db.getStrictAccents();
    const newLimit = await db.getDailyNewLimit();
    const delaySec = await db.getAgainDelaySec();
    const spellingRows = await db.getPcicSpellingList();
    const bonus = await db.getPcicNewBonus(day);
    // PLAN-ketiranyu 7. lépés: a feloldott igeidők a kész nyelvtani leckékből
    // (csak spanyol célnyelven van igeidő-kapu).
    const grammarRows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
    const introducedToday = cards.filter((c) => c.introducedAt === day).length;
    setTenses(resolvedTensesFromLessons(doneGrammarTopicProgress(dir, grammarRows).keys()));
    setLevel(lvl);
    setAllLevelCards(rawCards);
    setStrictAccents(strict);
    setDailyNewLimit(newLimit);
    setAgainDelaySec(delaySec);
    setPcicSpellingIds(new Set(spellingRows.map((r) => r.itemId)));
    setToday(day);
    setAllCards(new Map(cards.map((c) => [c.itemId, c])));
    setQueue(pickSm2Session(cards, pcicIntroOrder(newOrder, cards, lvl), day, pcicNewBudget({ limit: newLimit, bonus, introducedToday })));
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
    // dependency of this async callback (FB minta, lásd app/spelling.tsx); it
    // is stable, so nothing changes at runtime, but an empty array here counts
    // as broken memoization.
  }, [setTypedAnswer]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // s1: a szint-választó lapon koppintva azonnal a választott szint pakliját
  // adja (a lap előbb bezár, hogy a váltás ne tűnjön befagyottnak).
  const handleSelectLevel = async (lvl: PcicViewLevel) => {
    setLevelSheetOpen(false);
    if (lvl === level) return;
    await getDb().setPcicLevel(lvl);
    setLoading(true);
    await load(lvl);
  };

  const newOrder = useMemo(() => pcicItemsForViewLevel(level).map((i) => i.id), [level]);
  const current = queue[0];
  const currentItem = current ? findPcicItem(current.itemId) : undefined;

  // PLAN-ketiranyu 4. lépés: a FeedbackButton párcímkéje az aktív iránnyal
  // (korábban "es-en"-re volt égetve, holott a tényleges viselkedés en-es volt).
  const languagePair = target === 'es' ? 'en-es' : 'es-en';

  // PLAN-ketiranyu 4. lépés: a prompt a kiinduló nyelvű mező, a válasz a
  // célnyelvű; en-es-ben ez a régi sorrend (prompt en, válasz es), es-en-ben
  // fordítva. `sourceLang` a prompt/felolvasás nyelve, `target` a válaszé.
  const sourceLang = target === 'es' ? 'en' : 'es';

  // PLAN-fb0924 7b. lépés (FB384, D4): ha a szónak több, érdemben eltérő
  // jelentése van (data/pcic/senses.json, a duplikátum-egyesítés töltötte
  // fel), a prompt (és a felolvasás) mindet mutatja/mondja " · "-tal
  // elválasztva; a beírandó válasz ettől függetlenül a szó maga marad
  // (currentItem.es). `currentItem` fentebb defíniált, ez az effekt ELŐTT
  // kell, mert az is ezt mondja ki. PLAN-ketiranyu 4. lépés: a jelentés-lista
  // angol gloss, csak es célnyelven van értelme (en-es irány).
  const senses = target === 'es' && currentItem ? sensesFor(currentItem.id) : undefined;
  const promptSource = target === 'es' ? currentItem?.en : currentItem?.es;
  const promptText = senses ? senses.map((sn) => sn.en).join(' · ') : promptSource;
  const answerText = target === 'es' ? currentItem?.es : currentItem?.en;

  // FB319/FB391: a prompt felolvasása ÉS a beviteli mező fókusza, amikor egy
  // ÚJ lap kerül képernyőre (kinyílik a billentyűzet). Csak a
  // `current?.itemId` váltására fusson (a `grade` a closure-ből olvasva
  // dönti el, hogy még nincs felfedve), felfedéskor (a `grade` state
  // változásakor) ne ismételje - se a felolvasás, se a fókusz.
  // PLAN-ketiranyu 7. lépés: mondatkártya alatt nem szól a következő prompt;
  // a kártya bezárásakor (sentenceOpen false) szól, mint egy új lapnál.
  const sentenceOpen = sentenceCard !== null;
  useEffect(() => {
    if (!loading && !sentenceOpen && currentItem && promptText && !grade) {
      speak(promptText, speechLang(sourceLang));
      inputRef.current?.focus();
    }
    // PLAN-play 11. lépés: kártyaváltáskor a folyamatban lévő felolvasás
    // (pl. Check utáni szó+példamondat lánc) álljon le, LECKE-SEMA 3.3 minta.
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.itemId, loading, sentenceOpen]);

  const dueRemaining = queue.filter((c) => c.state !== 'new').length;
  const newRemaining = queue.filter((c) => c.state === 'new').length;
  const doneToday = countDoneToday([...allCards.values()], today);
  // FB387/395 (PLAN-fb0924 1b. lépés): a fejléc mutassa, MIBŐL áll a mai
  // bevezetés (szó vs. mondat), plusz a mai teljes keret (limit + bónusz).
  const introducedTodayByKind = countIntroducedTodayByKind([...allCards.values()], today, (id) => findPcicItem(id)?.kind);
  const todayNewBudget = dailyNewLimit + pcicBonus;

  // SZ2 (SZAVAK.md): a DB-írás + számlálók itt, a queue-léptetés (advance) a
  // hívó handleGrade-ben, külön.
  const commitGrade = async (g: Sm2Grade): Promise<Sm2Card | null> => {
    if (!current) return null;
    const wasNew = current.state === 'new';
    const before = { ...current };
    const next = sm2Review(current, g, today);
    await getDb().upsertPcicCard(next);
    // PLAN-play 12. lépés: a napi streak-et innentől a PCIC-értékelés írja (a
    // Tanulás fül vitte el az egyetlen korábbi hívót); a metódus a nap első
    // hívásán túl no-op, tehát Again-re is biztonságos.
    await getDb().updateStreak();

    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade, wasNew, g, counted: true, cadenceBefore: cadence });
    setSessionAnswered((n) => n + 1);
    if (wasNew) setSessionNew((n) => n + 1);
    if (g === 'again') setSessionAgain((n) => n + 1);
    return next;
  };

  // FB364: a `grade`-et is átadja a requeuenak, hogy csak a "Nem tudtam"
  // (again) kártya kapjon returnAt-időzítőt, a "Tudtam" (good) ne.
  const advance = (next: Sm2Card, g: Sm2Grade) => {
    setQueue((prev) => requeueAfterGrade(prev, next, today, g, Date.now(), againDelaySec));
    setTypedAnswer('');
    setArticlePick('');
    setGrade(null);
    setCardSeq((n) => n + 1);
  };

  // PLAN-play 11. lépés: Check után a szó felolvasása UTÁN, láncolva, magától
  // szól a példamondat is, ha van a tételhez (data/pcic/<szint>-sentences.json).
  // PLAN-ketiranyu 4. lépés: mindkettő a célnyelven szól, nem mindig spanyolul.
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
      // Kálmán 2026-09-21: üres beküldés is felfedi a helyes alakot és
      // felolvassa, de nem értékel automatikusan; a koppintás dönt, mint
      // bármelyik felfedésnél.
      const g = gradePcicAnswer('', answerText, strictAccents);
      const revealed: PcicGrade = { ...g, match: 'wrong', accentOnly: undefined };
      setGrade(revealed);
      if (revealed.match !== 'exact') setArticlePick(articleOf(revealed.best));
      speakRevealed(g.best);
      return;
    }
    // FB321: felfedéskor mindig szóljon a helyes célnyelvi alak.
    const g = gradePcicAnswer(answer, answerText, strictAccents);
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
    // PLAN-ketiranyu 7. lépés: minden 4. ÚJ szó után jöhet egy mondatkártya
    // (K3: csak gyakorlás, az eredménye nem ír SRS-t).
    if (!wasNew) return;
    const cardsById = new Map(allLevelCards.map((c) => [c.itemId, c]));
    for (const [id, c] of allCards) cardsById.set(id, c);
    cardsById.set(next.itemId, next);
    const step = nextSentenceStep(cadence, next.itemId, {
      target,
      cards: cardsById.values(),
      tenses,
      findItem: findPcicItem,
      vocab: () => pcicItemsForViewLevel(level).map((i) => (target === 'es' ? i.es : i.en)),
    });
    setCadence(step.state);
    setSentenceCard(step.card);
  };

  const handleUndo = async () => {
    if (!lastGraded) return;
    await getDb().upsertPcicCard(lastGraded.before);
    setAllCards((prev) => new Map(prev).set(lastGraded.before.itemId, lastGraded.before));
    setQueue((prev) => requeueAfterUndo(prev, lastGraded.before, lastGraded.after, today));
    // A padló 0, mert a session-reset (load) közben is lehet nyomni.
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

  // PLAN-play 12. lépés (s3, döntés a): csak Check után hívható (a gomb csak
  // grade-nél látszik); PCIC-azonosítóval kerül a listára (lib/database.ts
  // pcic_spelling_list), a helyesírás-tréner (app/spelling.tsx) ebből is olvas.
  const handleAddSpelling = async () => {
    if (!current) return;
    await getDb().addToPcicSpellingList(current.itemId);
    setPcicSpellingIds((prev) => new Set(prev).add(current.itemId));
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

  const handleReset = () => {
    const doReset = async () => {
      // Csak az AKTÍV szint kártyáit üríti (a haladás szintenként külön él);
      // "A1+"/"A2+" nézeten a mögöttes valódi szintet (a lánc/mondat ugyanaz
      // a fájl/haladás, mint a szó-pakli, PLAN-fb0924 8. lépés).
      await getDb().resetPcicCards(realLevelOfView(level).toLowerCase());
      setLoading(true);
      await load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${s.pcic.resetConfirmTitle}\n${s.pcic.resetConfirmMessage}`)) doReset();
    } else {
      Alert.alert(s.pcic.resetConfirmTitle, s.pcic.resetConfirmMessage, [
        { text: s.feedback.cancel, style: 'cancel' },
        { text: s.pcic.resetConfirmYes, style: 'destructive', onPress: doReset },
      ]);
    }
  };

  // FB314/385/386: nincs több esedékes/új lap, de a témakörben van még be
  // nem vezetett tétel; ez a napi keretet bővíti +10-zel (perzisztálva,
  // a naptári nappal lejár) és újraépíti a sort.
  const handleMoreNew = () => {
    const activeCards = [...allCards.values()];
    const introducedToday = activeCards.filter((c) => c.introducedAt === today).length;
    const next = nextPcicNewBonus({ limit: dailyNewLimit, bonus: pcicBonus, introducedToday });
    setPcicBonus(next);
    getDb().setPcicNewBonus(next, today).catch(() => {});
    setQueue(
      pickSm2Session(
        activeCards,
        pcicIntroOrder(newOrder, activeCards, level),
        today,
        pcicNewBudget({ limit: dailyNewLimit, bonus: next, introducedToday })
      )
    );
  };

  // s1 (anki-ui-terv.html): a fejléc ELSŐ chipje a kiválasztott szint,
  // koppintásra a szint-választó lap nyílik; a meglévő négy chip változatlan.
  // 5b: a régi egysoros szöveg-fejléc (`s.pcic.header`) helyett BadgeRow chip-sor;
  // a négy szám ugyanaz, csak külön i18n kulcsokból (badgeTotal/Due/New/Done).
  // PLAN-hibaim.md 4. lépés: a "Hibáim" belépő önálló komponens (saját
  // betöltéssel), hogy ez a fájl (785 sor) ne nőjön 800 fölé; csak akkor
  // renderel, ha van betöltött köteg.
  // PLAN-fb0924 8. lépés (FB394/396): a fejléc chip a "+1" szinten "A1 +1"
  // alakban olvasható (a belső azonosító "A1+", térköz nélkül).
  const levelChipLabel = level === 'A1+' || level === 'A2+' ? `${level.slice(0, 2)} +1` : level;

  const headerRow = (
    <>
    <View style={styles.headerRow}>
      <View style={styles.headerBadges}>
        {g.brutal ? (
          // NY19: a szint-chip doboz (aktív = a kitöltés).
          <BrutalBox testID="learn-level-chip" fill="a" offset={2} boxStyle={styles.brutalLevelChip} onPress={() => setLevelSheetOpen(true)}>
            <Text style={[styles.levelChipText, { color: g.onFill, fontWeight: '500' }]}>{levelChipLabel} ▾</Text>
          </BrutalBox>
        ) : (
          <Pressable style={[styles.levelChip, { backgroundColor: colors.tint }]} onPress={() => setLevelSheetOpen(true)}>
            <Text style={styles.levelChipText}>{levelChipLabel} ▾</Text>
          </Pressable>
        )}
        <BadgeRow
          colors={colors}
          items={[
            { label: s.pcic.badgeTotal(newOrder.length) },
            { label: s.pcic.badgeDue(dueRemaining), tone: 'blue' },
            { label: s.pcic.badgeNew(newRemaining), tone: 'green' },
            { label: s.pcic.badgeDone(doneToday), tone: 'pink' },
          ]}
        />
      </View>
      <View style={styles.headerIcons}>
        {lastGraded && (
          <Pressable onPress={handleUndo} hitSlop={12} style={styles.resetBtn} accessibilityLabel={s.pcic.undo}>
            <Text style={styles.resetIcon}>↶</Text>
          </Pressable>
        )}
        <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
          <Text style={styles.resetIcon}>🗑️</Text>
        </Pressable>
      </View>
    </View>
    {/* FB387/395 javítás: a régi ötödik BadgeRow-chip (miből áll a mai bevezetés
        + a mai teljes keret) egy hosszú, egybefüggő szöveg volt, ami chipként
        kilógott a képernyő jobb széléről (nem fért a sorba, és a chip belseje
        nem tördelhető). Külön, teljes szélességű, tördelhető sor lett belőle,
        a chip-sor ALATT; a tartalom (i18n) változatlan. */}
    <Text style={[styles.todayLine, { color: colors.tabIconDefault }]}>
      {s.pcic.badgeIntroducedToday(introducedTodayByKind.words, introducedTodayByKind.sentences, todayNewBudget)}
    </Text>
    <MistakesEntry colors={colors} />
    </>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // PLAN-ketiranyu 7. lépés: a mondatkártya a következő szókártya ELŐTT jön
  // (a done-képernyő előtt is). A saját gombja zár; nem ír SRS-t (K3).
  if (sentenceCard) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
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
              onResult={() => setSentenceCard(null)}
            />
          </ScrollView>
        ) : (
          // FB397: a begépelős mondatkártya saját görgetője + a dokkolt Check sáv a
          // billentyűzet fölött (mint a szókártyán), ezért nincs külső ScrollView.
          <TypedSentenceCard
            key={sentenceCard.itemId}
            sourceSentence={sentenceCard.source}
            targetSentence={sentenceCard.target}
            strictAccents={strictAccents}
            speechLocale={speechLang(target)}
            onResult={() => setSentenceCard(null)}
            dockLift={dockLift}
            dockH={dockH}
            onDockHeight={setDockH}
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
    // FB317: hány PCIC-tétel van már bevezetve (nem 'new' állapotú) a teljes
    // listából, a done-képernyő saját haladás-csíkjához.
    const introducedCount = [...allCards.values()].filter((c) => c.state !== 'new').length;
    const introducedPct = newOrder.length > 0 ? (introducedCount / newOrder.length) * 100 : 0;
    return (
      <View style={[styles.container, styles.doneContainer, { backgroundColor: colors.background }]}>
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        <View style={styles.doneHeader}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.pcic.doneTitle}</Text>
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
          g.brutal ? (
            <BrutalButton testID="learn-more-new" label={s.pcic.moreNew(10)} onPress={handleMoreNew} style={styles.brutalMoreNew} />
          ) : (
          <Pressable style={[styles.checkBtn, { backgroundColor: '#38BDF8' }]} onPress={handleMoreNew}>
            <Text style={styles.checkBtnText}>{s.pcic.moreNew(10)}</Text>
          </Pressable>
          )
        )}
        <FeedbackButton level={level} languagePair={languagePair} currentCard="pcic" />
      </View>
    );
  }

  // FB320/FB352: a fejléc alatti haladás-csík a `doneToday` perzisztált napi
  // számból épül (nem a mountonként nullázódó `sessionAnswered`-ből), hogy
  // tab-váltás vagy app-újraindítás után is a valós napi haladást mutassa,
  // ne ugorjon vissza üresre.
  const sessionTotal = doneToday + queue.length;
  const sessionPct = sessionTotal > 0 ? (doneToday / sessionTotal) * 100 : 0;

  // 5b: a lap tetejére kerülő lap/lépés-jelvény (CardShell chip propja),
  // a korábbi sectionRow-beli stepBadge szövegek helyén.
  const chipLabel =
    current.state === 'new'
      ? s.pcic.newBadge
      : current.state === 'learning' && LEARNING_STEPS > 1
        ? s.pcic.learningStep(current.step + 1, LEARNING_STEPS)
        : undefined;

  // 5c: szófaj-chip a szó alatt, a spanyol alakból (lib/pcicPos.ts, döntés 6b).
  // PLAN-ketiranyu 4. lépés (3. pont): posOf csak es célnyelven fut (a
  // szabály/korpusz spanyol szóalakra épül, angol célnyelven nincs értelme).
  const pos = target === 'es' ? posOf(currentItem) : null;

  // FB392/393: ℹ️ jegyzet, CSAK ha az itemnek van (lib/pcicNotes.ts); a
  // nyitottság LEVEZETETT (noteOpenFor === az aktuális item id-je), tehát
  // kártyaváltáskor magától becsukódik, nincs rá külön effekt.
  const note = pcicNoteText(currentItem.id);
  const noteOpen = noteOpenFor === currentItem.id;

  // FB363/FB367: régió-chip (PCIC `[Régió]` zárójel tartalma) és mx-chip
  // (spanyolországi/mexikói köznyelvi eltérés) a szófaj-chip mellett.
  const regionChipLabel = currentItem.region
    ? `${currentItem.region.toLowerCase() === 'méxico' ? '🇲🇽' : '🌎'} ${currentItem.region}`
    : undefined;
  const mxChipLabel = currentItem.mx ? `🇲🇽 ${currentItem.mx}` : undefined;

  // T1 (anki-ui-terv.html): a dokkolt Check sáv felfedés után "Next"-re vált,
  // ugyanazzal a hellyel/mérettel, a javasolt értékeléssel a feliratban.
  const nextGrade = grade ? suggestedGrade(grade) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {headerRow}
      <LevelPickerSheet
        visible={levelSheetOpen}
        active={level}
        cards={allLevelCards}
        colors={colors}
        title={s.pcic.chooseLevel}
        target={target}
        onSelect={handleSelectLevel}
        onClose={() => setLevelSheetOpen(false)}
      />

      {g.brutal ? (
        <SegmentBar testID="learn-progress" filled={segmentsFilled(sessionPct, 8)} segments={8} style={styles.brutalProgress} />
      ) : (
        <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.tint, width: `${sessionPct}%` }]} />
        </View>
      )}

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: 16 + dockH + dockLift }]}
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
          {/* 5b: a szó melletti 🔊 újra elmondja az angolt (Kálmán kiegészítése,
              anki-ui-terv.html), ugyanazzal a hívással, mint a lap-nyitáskori FB319 felolvasás. */}
          <View style={styles.wordRow}>
            {/* FB404/405/413: a hosszú szó / mondat ("reason (justification)", "they are
                going to arrive") a hosszától függő betűmérettel, összemenő szélességgel;
                enélkül a natív sor kiterjedt a kártyán túlra és a bal széle levágódott. */}
            <FitText base={32} maxLines={3} reserve={note ? 200 : 150} style={[styles.frontText, { color: colors.text }]}>
              {promptText ?? ''}
            </FitText>
            <Pressable onPress={() => speak(promptText ?? promptSource ?? '', speechLang(sourceLang))} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
            {/* FB392/393: ℹ️ gomb, csak jegyzetes itemen; koppintásra ki/be
                nyílik a jegyzet, kártyaváltáskor levezetve becsukódik. */}
            {note && (
              <Pressable
                onPress={() => setNoteOpenFor(noteOpen ? null : currentItem.id)}
                style={styles.speakBtn}
                accessibilityLabel="note"
                testID="pcic-note-toggle"
              >
                <Text style={styles.speakIcon}>ℹ️</Text>
              </Pressable>
            )}
          </View>
          {note && noteOpen && (
            <Text testID="pcic-note-text" style={[styles.noteText, { color: colors.tabIconDefault }]}>
              {note}
            </Text>
          )}
          {/* 5c: a chip (szófaj) + a szekció ugyanabban a sorban látszik
              gépeléskor és felfedés után is, hogy háromszor ismétlődő angol
              promptnál is megkülönböztethető legyen a tétel. */}
          <View style={styles.sectionRow}>
            {pos && (
              <View style={[styles.posChip, { backgroundColor: colors.background }, g.brutal && [styles.brutalPos, { borderColor: g.ink }]]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>
                  {pos.gender ? `${s.pos[pos.pos]} · ${pos.gender}` : s.pos[pos.pos]}
                </Text>
              </View>
            )}
            {regionChipLabel && (
              <View style={[styles.posChip, { backgroundColor: colors.background }, g.brutal && [styles.brutalPos, { borderColor: g.ink }]]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>{regionChipLabel}</Text>
              </View>
            )}
            {mxChipLabel && (
              <View style={[styles.posChip, { backgroundColor: colors.background }, g.brutal && [styles.brutalPos, { borderColor: g.ink }]]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>{mxChipLabel}</Text>
              </View>
            )}
            <Text style={[styles.sectionText, { color: colors.tabIconDefault }]}>{currentItem.section}</Text>
          </View>

          {/* SZ7 (SZAVAK.md): FB188 névelő-gombsor a Learn fülről, ⊘ az alapállás.
              FB214 kiegészítés: a PCIC-en a chip már mutatja, ha nem főnév, a
              sor csak noun/ismeretlen szófajnál jár (lib/articlePicker.ts).
              PLAN-ketiranyu 4. lépés (3. pont): csak es célnyelvnél jár. */}
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

          {/* PLAN-play 12. lépés (s3, döntés a): a "Add to spelling" gomb csak
              Check után látszik, a "Don't learn this" mellett; a meglévő gomb
              mérete/helyzete változatlan. */}
          <View style={styles.bottomRow}>
            {grade && (
              <Pressable onPress={handleAddSpelling} hitSlop={8}>
                <Text
                  style={[
                    styles.spellingBtn,
                    { color: pcicSpellingIds.has(current.itemId) ? '#22C55E' : colors.tabIconDefault },
                  ]}
                >
                  {pcicSpellingIds.has(current.itemId) ? s.pcic.inSpellingList : s.pcic.addToSpelling}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={handleDontLearn} hitSlop={8}>
              <Text style={[styles.dontLearn, { color: colors.tabIconDefault }]}>{s.pcic.dontLearn}</Text>
            </Pressable>
          </View>
        </CardShell>
      </ScrollView>

      {/* T1 (anki-ui-terv.html): Check után UGYANAZ a dokkolt sáv (hely+méret
          változatlan) "Next"-re vált, felirata kimondja a javasolt értékelést;
          a két gomb a kártyában felülbírálásra marad. */}
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
  // FB320: a loading-ág is a közös containert használja, de a pörgettyűnek
  // középen kell maradnia, nem a tetejére ugrania.
  centered: {
    justifyContent: 'center',
  },
  // FB320: vékony haladás-csík a fejléc alatt, a tanuló nézeten.
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
  // s1 (anki-ui-terv.html): a szint-chip + a meglévő négy BadgeRow chip egy soron.
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
  brutalMoreNew: { marginTop: 24 },
  brutalProgress: { marginBottom: 16 },
  brutalArticle: { minWidth: 48, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  brutalDim: { opacity: 0.6 },
  brutalPos: { borderWidth: 2, borderRadius: 0 },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // FB387/395 javítás: a mai szó/mondat bontás saját, teljes szélességű,
  // tördelhető sora a chip-sor alatt (lásd a headerRow utáni Text-et).
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
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
  },
  // FB317: színes done-képernyő, a components/DoneScreen.tsx vizuális
  // nyelvén (doneEmoji, statsGrid), de saját stílusokkal.
  doneContainer: {
    gap: 16,
  },
  doneHeader: {
    alignItems: 'center',
  },
  doneEmoji: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 8,
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
  // 5b: a kártya-doboz a CardShell-be költözött, a görgető pedig a dokkolt
  // sáv magasságát tartja alul (cardScroll/cardScrollContent).
  cardScroll: {
    flex: 1,
    width: '100%',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  // 5b: a szó-sor (szó + 🔊), a CardShell tetején.
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // 5b: a Learn frontText méretét vette át (32/bold), hogy a két fül kártyája
  // azonos súlyú szót mutasson.
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  // FB392/393: a ℹ️ jegyzet szövege, a wordRow alatt.
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
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
  // 5c: szófaj-chip (noun/verb/phrase) a szekció-szöveg mellett.
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
    marginBottom: 8,
  },
  // PLAN-play 12. lépés (s3): a "Add to spelling" gomb sora a "Don't learn
  // this" mellett; ungraded állapotban (a gomb rejtve) egyetlen gyerek marad,
  // a flex-end ilyenkor is a régi jobbra-igazított helyre teszi a dontLearn-t.
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  spellingBtn: {
    fontSize: 13,
    marginBottom: 8,
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
