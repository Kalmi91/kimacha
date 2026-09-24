export default {
  onboarding: {
    welcome: 'Welcome to Kimacha! Thank you for using the app, it means a lot.',
    // Kimacha Play: single en-es pair (Kálmán, 2026-09-22), no more language
    // picker here, just a way to start the course.
    start: 'Get Started',
  },
  // Play-vágás 7. lépés: the flashcard-review keys (word/sentence prompts,
  // typing, skip, borrowed-from-topic, new/review tags, spelling-tap hint)
  // are gone with the Learn tab (step 3); correct/wrong/check still label the
  // PCIC and spelling screens' feedback.
  card: {
    check: 'Check',
    correct: 'Correct!',
    wrong: 'Wrong',
  },
  buttons: {
    spelling: 'Spelling',
  },
  done: {
    // K33 (play-vágás, 2026-09-22): the Learn tab (Done screen) is gone, this
    // key stays, the Stats tab's daily-streak tile uses it.
    streak: 'day streak',
  },
  tabs: {
    settings: 'Settings',
    grammar: 'Grammar',
    stats: 'Stats',
    pcic: 'PCIC',
  },
  // K33 (play-vágás, 2026-09-22): a Game/Talk fülek kikerültek, ez a
  // namespace csak a components/grammar/GrammarDrill.tsx feedback- és
  // mark-item-feliratait tartja meg (a hub/confusables/myth/… kulcsok mentek).
  games: {
    understood: 'Got it',
    moreLabel: 'More',
    correctFeedback: 'Correct!',
    wrongFeedback: 'Not quite!',
    grammarChoice: {
      progress: (current: number, total: number) => `${current} / ${total}`,
      markPrompt: (wordClass: string) => `Tap the ${wordClass} in the sentence.`,
      wordClass: {
        noun: 'NOUN',
        verb: 'VERB',
        adjective: 'ADJECTIVE',
        adverb: 'ADVERB',
        article: 'ARTICLE',
        pronoun: 'PRONOUN',
        preposition: 'PREPOSITION',
      } as Record<string, string>,
      markWrong: 'Not this one. Look for the word that plays that role.',
    },
  },
  grammar: {
    coverage: (done: number, written: number, planned: number) =>
      `${done} lessons finished · ${written} of ${planned} written`,
    levelMeta: (done: number, topics: number, written: number) =>
      `${done}/${topics} done · ${written} lessons available`,
    yourLevel: 'you are here',
    soon: 'coming',
    coreTag: 'core',
    corePlusTag: 'core+',
    started: 'started',
    notStarted: 'new',
    soonLong: 'This lesson has not been written yet. It is on the list, and the rest of the level is already open.',
    footNote: 'The whole grammar of the language, A1 to C1, in teaching order. Lessons marked "coming" are planned, not written yet.',
    ruleLabel: 'The rule',
    examplesLabel: 'Examples',
    exceptionsLabel: 'Exceptions and edge cases',
    // D3 (FB290, 2026-09-17): one button per kind instead of `startDrill` (all at once).
    startChoice: (n: number) => `Sentences (${n})`,
    startMatch: (n: number) => `Matching (${n})`,
    startForm: (n: number) => `Forms (${n})`,
    // TASK-8 (D4, FB288): "why this sentence" drill kind start button.
    startWhy: (n: number) => `Why? (${n})`,
    backToRule: 'Read the rule again',
    practiceAgain: 'Practice again',
    nextTopic: 'Next topic',
    backToSyllabus: 'Back to the course',
    doneGood: 'That rule is sitting well.',
    doneAgain: 'Worth reading the rule once more before the next one.',
    // FB216: kevert nyelvű felolvasás a lecke-szövegre.
    readAloud: 'Read aloud',
    // LECKE-SEMA 2.1-2.2: match/form feladat-fajták.
    matchHint: 'Match the words',
    formHint: 'Type the correct form',
    showTable: 'Table',
    check: 'Check',
    // NY3 (NYELVTAN.md "Első szelet"): tense rewrite drill.
    startTransform: (n: number) => `Rewrite (${n})`,
    // FB316 (NYELVTAN.md NY10): sentence-rewrite drill in rounds of 10 on big lessons.
    startTransformRound: (n: number, total: number) => `Sentence rewrite (${n} of ${total})`,
    moreRound: (n: number) => `${n} more`,
    rewriteTo: (tense: string) => `Rewrite in the ${tense}`,
    showTranslation: 'Show translation',
    correct: 'Correct',
    correctAnswer: 'Correct answer',
    next: 'Next',
    accentHint: 'Accepted without accents, missing accents are shown',
    // FB328: cumulative correct-answer rate, on the syllabus list and the done screen.
    lessonPercent: (n: number) => `So far: ${n}% correct`,
    // PLAN-play 13. lépés: the table-deck button, only on lessons that have a
    // conjugation table (lib/grammar/tableDeck.ts).
    practiceTable: (n: number) => `Practice the table · ${n} cells`,
    // FB376: names the word a "why" question is asking about.
    whyFocus: (word: string) => `What is "${word}"?`,
  },
  settings: {
    weeklyGoal: 'Weekly study goal',
    weeklyGoalHours: (h: string) => `${h} hours / week`,
    weeklyGoalDoneTag: '✓ DONE',
    missingVoice: (langs: string) => `⚠️ No installed voice for: ${langs}. Download it in the phone's text-to-speech settings; until then the app stays silent in that language.`,
    dailyNewLimit: 'New words a day',
    dailyNewLimitWords: (n: string) => `${n} words / day`,
    spellingPractice: (due: number, total: number) => `Spelling practice · ${due} due, ${total} on the list`,
    strictAccents: 'Accents count',
    strictAccentsHint: 'A missing accent (á, é, ñ) is a mistake when typing.',
    articlePicker: 'Article buttons',
    articlePickerHint: 'On Spanish noun cards you pick el/la/los/las instead of typing it. ⊘ means no article.',
  },
  backup: {
    backup: 'Backup',
    restore: 'Restore',
    confirmTitle: 'Restore',
    confirmMessage: 'This overwrites your current progress with the backup contents. Are you sure?',
    confirmYes: 'Restore Now',
    doneTitle: 'Restored!',
    errorTitle: 'Error',
    exportError: 'The backup could not be created.',
    importError: 'Invalid or corrupted backup file. Your data was not changed.',
  },
  progress: {
    wordsKnown: 'Words Known',
  },
  // UTEMEZO 7. szakasz: the small tag on top of every card.
  // K33 (play-vágás, 2026-09-22): the Learn tab's header (three numbers +
  // focus session) is gone; levelProgress stays, Stats still uses it.
  // Play-vágás 7. lépés: close had no caller left either, removed.
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} words`,
  },
  spelling: {
    title: 'Spelling Practice',
    empty: 'No words due',
    totalInList: (n: number) => `${n} words in your list`,
  },
  feedback: {
    button: 'Feedback',
    placeholder: 'Share your thoughts...',
    send: 'Send',
    cancel: 'Cancel',
    thanks: 'Thank You!',
  },
  usage: {
    plusOneMinute: '+1 minute wooo!',
    milestoneSession: '🔥 Wow, {min} minutes in one go!',
    milestoneDaily: '🎉 {min} minutes today, you are doing great!',
    // FB149: past the first hour, every quarter of an hour, random line.
    milestoneLong: [
      '🔥 {hours} hours today! This is not studying any more, this is training.',
      '💪 {min} minutes in the bag. The language cannot run away now.',
      '🚀 Another quarter hour, another stretch won: {min} minutes and counting.',
      '🧠 {min} minutes in one day. Your brain is wiring something new right now.',
      '⚡ {hours} hours! At this pace it is weeks, not years.',
      '🏔️ {min} minutes and still climbing. That is the whole difference.',
      '🌊 {min} minutes straight. Today the words come to you.',
      '🎯 {hours} hours in today. Whoever puts that in, takes it out.',
    ],
    dailyGreeting: '👋 Hi! Let\'s start today\'s practice!',
    // FB108: midnight rollover, the finished day's stats plus a celebration.
    // Picked at random, so the lines come back around over time.
    dayRollover: [
      '🌙 Midnight! Yesterday: {words} words, {min} minutes. People who study at midnight are not doing it for fun.',
      '✨ Day closed with {words} words and {min} minutes. The city sleeps, you dream in Spanish.',
      '🕛 The clock turned! {min} minutes, {words} words, a whole day of work. Beautiful.',
      '🚀 A new day starts, the old one ended with {words} words and {min} minutes. That is a habit, not luck.',
      '🏆 {min} minutes, {words} words, and still here at midnight. That is persistence.',
      '🌟 Yesterday is done: {words} words, {min} minutes. Every word is a brick, and you built again.',
    ],
  },
  stats: {
    title: 'Usage Stats',
    today: 'Today',
    thisWeek: 'This Week',
    allTime: 'All-Time Total',
    bestDay: 'Best Day',
    daysActive: 'Days Active',
    minutes: (n: number) => `${n} min`,
    last7Days: 'Last 7 Days',
    weeklyGoal: 'Weekly Goal',
    goalProgress: (done: string, goal: string) => `${done} / ${goal} hours`,
    goalBehind: (left: string) => `⚠️ ${left} hours left to your goal`,
    goalReached: '🏆 Weekly goal reached!',
    noData: 'No usage yet, go learn something!',
    learningProgress: 'Learning Progress',
    reviewsToday: 'Reviews Today',
    // PLAN-play 12. lépés (s5): "known" = interval >= 21 nap, "graduated" =
    // túljutott a tanuló-lépéseken (lib/pcicStats.ts).
    known21: 'Known (21+ days)',
    graduatedLabel: 'Learning → Graduated',
    knownAtLevel: (level: string, known: number) => `${level} ${known}`,
    // FB100: how many words are put away for how long, and when they come back
    schedule: 'Schedule',
    scheduleDueNow: 'Waiting now',
    scheduleWaiting: (n: number) => `${n} words put away`,
    scheduleToday: 'Later today',
    scheduleTomorrow: 'Tomorrow',
    scheduleDays2to3: 'In 2-3 days',
    scheduleDays4to7: 'In 4-7 days',
    scheduleLater: 'In over a week',
    scheduleWords: (n: number) => `${n} words`,
    scheduleNext: (when: string) => `Next refresh: ${when}`,
    scheduleNextToday: (time: string) => `today ${time}`,
    scheduleNextTomorrow: (time: string) => `tomorrow ${time}`,
    scheduleNextDays: (days: number) => `in ${days} days`,
    scheduleEmpty: 'Nothing put away yet, learn a few words!',
  },
  // PLAN-pcic step 5: the PCIC tab (English -> Spanish typing, Anki buttons).
  pcic: {
    header: (due: number, newCount: number, doneToday: number, total: number) => `${total} words · due ${due} · new ${newCount} · done today ${doneToday}`,
    // 5b: a BadgeRow chip-sorának négy külön felirata (anki-ui-terv.html).
    badgeTotal: (n: number) => `${n} words`,
    badgeDue: (n: number) => `due ${n}`,
    badgeNew: (n: number) => `new ${n}`,
    badgeDone: (n: number) => `done ${n}`,
    // T1 only shows again/good (index.tsx GRADES), but `s.pcic[g]` indexes by
    // the full Sm2Grade type, so hard/easy stay for TS even though unreachable.
    again: "Didn't know",
    hard: 'Hard',
    good: 'Knew it',
    easy: 'Easy',
    doneTitle: 'Done for today',
    resetConfirmTitle: 'Reset progress',
    resetConfirmMessage: 'This clears all PCIC progress. Are you sure?',
    resetConfirmYes: 'Reset',
    undo: 'Undo',
    dontLearn: "Don't learn this",
    // PLAN-play 12. lépés (s3): "Add to spelling" gomb Check után.
    addToSpelling: '✎ Add to spelling',
    inSpellingList: '✓ In spelling list',
    learningStep: (step: number, total: number) => `step ${step}/${total}`,
    newBadge: 'new',
    moreNew: (n: number) => `+${n} new words`,
    tileAnswered: 'Answered',
    tileNew: 'New',
    tileAgain: 'Again',
    introduced: (n: number, total: number) => `${n} / ${total} words introduced`,
    // FB350/5. commit: a gombsor intervallum-előnézete (korábban lib/sm2.ts
    // sm2Preview-ban magyarul égetve be, minden nyelven).
    intervalToday: '<1 day',
    intervalDays: (n: number) => `${n} days`,
    // PLAN-play 10. lépés (s1/s2, anki-ui-terv.html): szint-választó + Next.
    chooseLevel: 'Choose level',
    next: (label: string) => `Next → ${label}`,
    accentForgiven: 'Missing accent, counted as correct',
  },
  // 5c: szófaj-chip a PCIC szó alatt (lib/pcicPos.ts).
  pos: {
    noun: 'noun',
    verb: 'verb',
    phrase: 'phrase',
  },
  // PLAN-play 13. lépés: the table-deck screen (a lesson's conjugation
  // tables, practiced Anki-style with the PCIC card UI).
  tableDeck: {
    chip: 'TABLE',
    promptCaption: 'person · verb',
    // FB378: caption for a cell with an English prompt (translate to Spanish).
    promptCaptionEn: 'translate to Spanish',
    progress: (done: number, total: number) => `${done} / ${total} done`,
    completeTitle: (n: number) => `All ${n} cells done 🎉`,
    startAgain: 'Start again',
    backToLesson: 'Back to the lesson',
  },
};
