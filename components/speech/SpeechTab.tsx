import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SpeechDone from '@/components/speech/SpeechDone';
import SpeechIntro from '@/components/speech/SpeechIntro';
import SpeechList from '@/components/speech/SpeechList';
import SpeechPlay from '@/components/speech/SpeechPlay';
import { PCIC_LEVELS, findPcicItem, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { knownTokens, resolvedTensesFromLessons } from '@/lib/knownSentence';
import { activeSourceFor, pairOf } from '@/lib/languagePair';
import { useLearner } from '@/lib/learner';
import { dropOrphanCards } from '@/lib/pcicSession';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { learnedEntries } from '@/lib/sentenceCards';
import { stopSpeaking } from '@/lib/speech';
import ScreenFeedback from '@/lib/screenFeedback';
import { recognitionAvailable } from '@/lib/speechRecognition';
import {
  SPEECH_ANSWER_KEY,
  SPEECH_LEVEL_KEY,
  SPEECH_MODE,
  SPEECH_PROGRESS_KEY,
  finishedProgress,
  parseRun,
  progressById,
  savedRun,
  setMode as withMode,
  startStory,
  storiesFor,
  unknownWords,
  type AnswerMode,
  type SpeechStory,
  type StoryProgress,
  type StoryRun,
  type StoryWord,
} from '@/lib/speech/stories';
import { localDateString } from '@/lib/usageStats';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useScreenLoad } from '@/lib/useScreenLoad';

// The Speak tab (beta speechTab, PLAN-beszed): a story the learner talks into. Four screens, one component each: the list (level and
// stories), the intro (new words, voice or typing), the story itself, and the end. This component holds what they share: the
// direction, the open run (kept in the resume store after every answer, so leaving the tab and coming back, also after the app was
// killed, continues where the learner was) and the finished stories (the `game_progress` table). No SRS writes, no XP.

type Screen = 'list' | 'intro' | 'play' | 'done';

const isLevel = (x: unknown): x is PcicLevel => typeof x === 'string' && (PCIC_LEVELS as string[]).includes(x);

// The tokens the learner knows, computed as the Situations do (the deck of the active direction has to be set before findPcicItem).
async function knownFor(dir: PcicTarget): Promise<ReadonlySet<string>> {
  const db = getDb();
  const cards = dropOrphanCards(await db.getPcicCards(), (id) => findPcicItem(id) !== undefined);
  // the unlocked tenses only matter for Spanish
  const rows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
  return knownTokens(dir, {
    learned: learnedEntries(cards, dir, findPcicItem),
    tenses: dir === 'es' ? resolvedTensesFromLessons(doneGrammarTopicProgress('es', rows).keys()) : undefined,
  });
}

export default function SpeechTab() {
  const { refresh } = useLearner();
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<PcicTarget>('es');
  // the learner's language (the texts around the story); the story itself is in the target language
  const source = activeSourceFor(target);
  const [screen, setScreen] = useState<Screen>('list');
  const [level, setLevel] = useState<PcicLevel>('A1');
  const [storyId, setStoryId] = useState<string | null>(null);
  const [run, setRun] = useState<StoryRun | null>(null);
  // how the learner answers; the intro changes it, the next story starts with it
  const [mode, setAnswerMode] = useState<AnswerMode>('voice');
  const [micOk, setMicOk] = useState(true);
  const [strictAccents, setStrictAccents] = useState(false);
  const [progress, setProgress] = useState<ReadonlyMap<string, StoryProgress>>(new Map());
  const [introWords, setIntroWords] = useState<readonly StoryWord[]>([]);
  // a new run remounts the story screen; `fresh` = its first line is read aloud (a resumed run is silent)
  const [runKey, setRunKey] = useState(0);
  const [fresh, setFresh] = useState(false);
  // The language pair on screen: a refocus keeps the screen, another pair replaces it. The pair, not only the target: the saved run,
  // the level, the way of answering and the progress rows are kept per pair (en->es and hu->es have their own).
  const shownPair = useRef<string | null>(null);

  // A finished run: the progress row (`best` keeps the higher value, so writing it twice changes nothing) and the saved run
  // dropped. It is called the moment the run becomes done, not when the end screen is reached, so leaving in between loses
  // nothing; the app-restart path (a saved run that is done) calls it too. A database that throws is logged: the learner still
  // gets the end screen, and the list still shows the tick for this session.
  const recordFinish = useCallback(async (story: SpeechStory, done: StoryRun) => {
    const db = getDb();
    const total = story.turns.length;
    const at = localDateString();
    setProgress((all) => new Map(all).set(story.id, finishedProgress(all.get(story.id), done, total, at)));
    try {
      const previous = (await db.getGameProgress(SPEECH_PROGRESS_KEY)).find((r) => r.itemId === story.id)?.data;
      await db.setGameProgress(SPEECH_PROGRESS_KEY, story.id, 'done', finishedProgress(previous, done, total, at));
    } catch (e) {
      console.warn('speech: could not write the progress', e);
    }
    await saveResumeValue(db, SPEECH_MODE, null);
  }, []);

  const load = useCallback(async () => {
    const db = getDb();
    const learner = await refresh(['direction', 'strictAccents']);
    setStrictAccents(learner.strictAccents);
    setProgress(progressById(await db.getGameProgress(SPEECH_PROGRESS_KEY)));
    const dir = learner.target;
    const pair = pairOf(dir);
    if (shownPair.current === pair) return;
    shownPair.current = pair;
    const all = storiesFor(dir);
    const savedLevel = await loadResumeValue(db, SPEECH_LEVEL_KEY);
    const savedAnswer = await loadResumeValue(db, SPEECH_ANSWER_KEY);
    const saved = all.length ? parseRun(await loadResumeValue(db, SPEECH_MODE), all) : null;
    const story = all.find((x) => x.id === saved?.id) ?? null;
    setTarget(dir);
    setAnswerMode(savedAnswer === 'type' ? 'type' : 'voice');
    setLevel(story ? story.level : isLevel(savedLevel) ? savedLevel : 'A1');
    setStoryId(story?.id ?? null);
    setRun(story ? saved : null);
    setFresh(false);
    setScreen(story && saved ? (saved.done ? 'done' : 'play') : 'list');
    setLoaded(true);
    // a saved run that is done (the app was killed after the last answer): the end screen still has to write the progress
    if (story && saved?.done) await recordFinish(story, saved);
  }, [refresh, recordFinish]);
  // Leaving the tab stops the read-aloud (the tab stays mounted).
  useScreenLoad(load, { onBlur: stopSpeaking });
  const checkMic = useCallback(async () => {
    setMicOk(await recognitionAvailable());
  }, []);
  useLoadOnMount(checkMic);

  const stories = storiesFor(target);
  const story = stories.find((x) => x.id === storyId) ?? null;
  // Android's hardware Back on an inner screen does what the on-screen back link does (leaving the story keeps the run) and is
  // consumed; on the list it is left alone (it leaves the tab as before). Only while this tab is focused.
  const backRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    backRef.current = () => {
      if (!story || screen === 'list') return false;
      if (screen === 'done') setRun(null);
      setScreen('list');
      return true;
    };
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
      return () => subscription.remove();
    }, []),
  );

  // the 💬 button is there before the first screen is (every screen names its feedback card, app/__tests__/screenContract.test.tsx)
  if (!loaded) return <ScreenFeedback placement="header" level="-" languagePair={pairOf(target)} currentCard="speech-list" />;

  const openId = run && !run.done ? run.id : null;
  // no recognizer = typing, whatever was chosen before
  const way: AnswerMode = micOk ? mode : 'type';

  const apply = (next: StoryRun, forStory: SpeechStory | null = null) => {
    setRun(next);
    if (next.done && forStory) void recordFinish(forStory, next);
    else void saveResumeValue(getDb(), SPEECH_MODE, savedRun(next));
  };
  const chooseLevel = (next: PcicLevel) => {
    setLevel(next);
    void saveResumeValue(getDb(), SPEECH_LEVEL_KEY, next);
  };
  const chooseMode = (next: AnswerMode) => {
    setAnswerMode(next);
    void saveResumeValue(getDb(), SPEECH_ANSWER_KEY, next);
  };
  const startRun = (s: SpeechStory, how: AnswerMode) => {
    apply(startStory(s, how));
    setRunKey((n) => n + 1);
    setFresh(true);
    setScreen('play');
  };
  const openStory = async (id: string) => {
    const opened = stories.find((x) => x.id === id);
    if (!opened) return;
    setStoryId(id);
    if (run && run.id === id && !run.done) {
      setFresh(false);
      setScreen('play');
      return;
    }
    setIntroWords(unknownWords(opened, await knownFor(target)));
    setScreen('intro');
  };
  const toList = () => setScreen('list');
  const showDone = (s: SpeechStory, done: StoryRun) => {
    setStoryId(s.id);
    setRun(done);
    setScreen('done');
  };

  if (!story || screen === 'list') {
    return (
      <SpeechList
        target={target}
        source={source}
        hasStories={stories.length > 0}
        level={level}
        onLevel={chooseLevel}
        progress={progress}
        openId={openId}
        onOpen={(id) => void openStory(id)}
      />
    );
  }
  if (screen === 'intro') {
    return (
      <SpeechIntro
        story={story}
        target={target}
        source={source}
        words={introWords}
        mode={mode}
        micOk={micOk}
        onMode={chooseMode}
        onStart={() => startRun(story, way)}
        onBack={toList}
      />
    );
  }
  if (screen === 'done' && run) {
    return (
      <SpeechDone
        story={story}
        run={run}
        target={target}
        source={source}
        onAgain={() => startRun(story, run.mode)}
        onList={() => {
          setRun(null);
          toList();
        }}
      />
    );
  }
  if (!run) return null;
  return (
    <SpeechPlay
      key={runKey}
      story={story}
      run={run}
      target={target}
      source={source}
      strictAccents={strictAccents}
      micOk={micOk}
      fresh={fresh}
      onRun={(next) => apply(next, story)}
      onMode={(next) => {
        apply(withMode(run, next));
        chooseMode(next);
      }}
      onBack={toList}
      onFinish={() => showDone(story, run)}
    />
  );
}
