export default {
  onboarding: {
    welcome: 'Welcome to Kimacha! Thank you for using the app, it means a lot.',
    // Kimacha Play: single en-es pair, no more language
    // picker here, just a way to start the course.
    start: 'Get started',
  },
  // the intro step after the welcome, and the theme step after it.
  intro: {
    title: 'How it works',
    start: "Let's start",
    first: 'Learning a language is a long, hard road. There will be tough days, but everyone can do it, and so can you.',
    words: 'Words: on cards, a small batch every day.',
    grammar: 'Grammar: short lessons where you build sentences.',
    exam: 'Then an exam: show what you know.',
    repetition: "Repetition is the key: a word comes back right when you're about to forget it.",
    overdo:
      "Don't overdo it: what's new today is a review tomorrow. Lots of new words today = lots of work tomorrow, when you might feel less like it.",
    closing: "Every day you'll know a little more than yesterday.",
  },
  onboardingTheme: {
    title: 'Pick a look',
    // The sample word on each row: the learned language's word, so it shows the font.
    sampleWord: 'el carro',
    know: 'I know',
    later: 'Later you can pick from 24 in Settings.',
    next: 'Continue',
  },
  // Play cut: the flashcard-review keys (word/sentence prompts,
  // typing, skip, borrowed-from-topic, new/review tags, spelling-tap hint)
  // are gone with the Learn tab; correct/wrong/check still label the
  // PCIC screen's feedback.
  card: {
    check: 'Check',
    correct: 'Correct!',
    wrong: 'Wrong',
    next: 'Next',
    typeSentence: 'Type the sentence',
    // the grey placeholder of the answer input field, with the name of the target language.
    typeIn: (lang: string): string => (lang === 'es' ? 'Type in Spanish' : 'Type in English'),
  },
  done: {
    // Play cut: the Learn tab (Done screen) is gone, this
    // key stays, the Stats tab's daily-streak tile uses it.
    streak: 'day streak',
  },
  tabs: {
    settings: 'Settings',
    grammar: 'Grammar',
    stats: 'Stats',
    pcic: 'Learn',
  },
  // accessibility labels (screen readers) of the controls that show only an icon or a symbol.
  a11y: {
    back: 'Back',
    close: 'Close',
    speak: 'Play audio',
    stopSpeaking: 'Stop audio',
    statusBarTint: 'Change the color of the top strip',
    increase: (what: string): string => `Increase ${what.toLowerCase()}`,
    decrease: (what: string): string => `Decrease ${what.toLowerCase()}`,
  },
  // Play cut: the Game/Talk tabs were removed, this
  // namespace keeps only the feedback and mark-item labels of components/grammar/GrammarDrill.tsx
  // (the hub/confusables/myth/… keys went).
  games: {
    understood: 'Got it',
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
      // the question line of the `why` drill, if the item has a `target` field
      // (the highlighted word/structure the question is about).
      whyQuestion: (target: string) => `Why «${target}»?`,
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
    // brutalist course list.
    doneTag: 'done',
    continueTag: 'continue →',
    weeklyGoalTitle: 'Weekly goal',
    weeklyGoalValue: (done: string, goal: string) => `${done} h / ${goal} h`,
    // brutalist drill.
    comboLabel: (n: number) => `combo x${n}`,
    perfect: 'perfect!',
    nextArrow: 'next →',
    // brutalist round end.
    statCorrect: 'correct',
    statTime: 'time',
    statStreak: 'streak',
    practiceThis: 'practice this',
    progressChange: (from: number | null, to: number) => (from === null ? `${to}%` : `${from}% → ${to}%`),
    oneMoreRound: 'one more round',
    soonLong: 'This lesson has not been written yet. It is on the list, and the rest of the level is already open.',
    footNote: 'The whole grammar of the language, A1 to C1, in teaching order. Lessons marked "coming" are planned, not written yet.',
    ruleLabel: 'The rule',
    examplesLabel: 'Examples',
    // one button per kind instead of `startDrill` (all at once).
    startChoice: (n: number) => `Sentences (${n})`,
    startMatch: (n: number) => `Matching (${n})`,
    startForm: (n: number) => `Forms (${n})`,
    // "why this sentence" drill kind start button.
    startWhy: (n: number) => `Why? (${n})`,
    backToRule: 'Read the rule again',
    practiceAgain: 'Practice again',
    nextTopic: 'Next topic',
    backToSyllabus: 'Back to the course',
    doneGood: 'You have that rule down.',
    doneAgain: 'Worth reading the rule once more before the next one.',
    // mixed-language read-aloud of the lesson text.
    readAloud: 'Read aloud',
    // match/form task kinds.
    matchHint: 'Match the words',
    formHint: 'Type the correct form',
    showTable: 'Table',
    check: 'Check',
    // tense rewrite drill.
    startTransform: (n: number) => `Rewrite (${n})`,
    // sentence-rewrite drill in rounds of 10 on big lessons.
    startTransformRound: (n: number, total: number) => `Sentence rewrite (${n} of ${total})`,
    moreRound: (n: number) => `${n} more`,
    rewriteTo: (tense: string) => `Rewrite in the ${tense}`,
    showTranslation: 'Show translation',
    correct: 'Correct',
    correctAnswer: 'Correct answer',
    next: 'Next',
    accentHint: 'Accepted without accents, missing accents are shown',
    // cumulative correct-answer rate, on the syllabus list and the done screen.
    lessonPercent: (n: number) => `So far: ${n}% correct`,
    // the table-deck button, only on lessons that have a
    // conjugation table (lib/grammar/tableDeck.ts).
    practiceTable: (n: number) => `Practice the table · ${n} cells`,
    // the word-deck button, only on table-less
    // lessons with >= 8 word cards (lib/grammar/tableDeck.ts wordCellsForLesson).
    practiceWords: (n: number) => `Practice the words · ${n} cards`,
    // the learner's own answer above the correct one for a wrong conjugation (AnswerCompare).
    yourAnswer: 'Your answer',
    // the line of an abandoned task under the button, e.g. "3/10 · 30%".
    runProgress: (done: number, total: number, pct: number) => `${done}/${total} · ${pct}%`,
    // button of the el / la article-chooser task (only where such a set exists).
    startArticle: (n: number) => `El or la? (${n})`,
    // temporary, new task kinds (error finder, word order, dictation).
    startSpot: (n: number) => `Spot the mistake (${n})`,
    startOrder: (n: number) => `Word order (${n})`,
    startDictation: (n: number) => `Dictation (${n})`,
    spotPrompt: 'Tap the word that is wrong',
    spotPickFix: 'Pick the right form',
    spotWordFine: 'That word is fine. Look again.',
    spotDelete: '(remove it)',
    orderHint: 'Put the words in order',
    dictationHint: 'Listen and type what you hear',
    dictationPlay: 'Play',
    dictationSlow: 'Slower',
  },
  settings: {
    // the theme-picker buttons (previously hard-coded in English in settings.tsx).
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    // the color-palette picker below the theme buttons.
    paletteElectric: 'Electric blue',
    paletteLime: 'Lime + pink',
    paletteBrand: 'Kimacha',
    paletteCyan: 'Cyan + violet',
    paletteOrange: 'Orange + teal',
    // the theme grid (app/themes.tsx), My mix (app/theme-mix.tsx) and the theme decor texts.
    themes: {
      title: 'Themes',
      oneLook: 'This theme has one look.',
      posterSlogan: 'LEARN, LEARN, LEARN!',
      sample: 'el carro',
      know: 'I know',
      // the theme decor texts (senior, retro95, y2k, gamer).
      readAloud: 'Read aloud',
      retroTitle: 'kimacha.exe',
      newWord: 'new word',
      gamerLevel: 'LVL',
      mixTitle: 'My mix',
      mixColors: 'Colors',
      mixFont: 'Font',
      mixShape: 'Shape',
      mixDecor: 'Decor',
      mixNone: 'None',
      mixSave: 'Use this mix',
      shockWorker: 'Shock worker',
      dailyPlan: 'Daily plan',
    },
    weeklyGoal: 'Weekly study goal',
    weeklyGoalHours: (h: string) => `${h} hours / week`,
    weeklyGoalDoneTag: '✓ DONE',
    missingVoice: (langs: string) => `⚠️ No voice installed for: ${langs}. Download it in the phone's text-to-speech settings; until then the app stays silent in that language.`,
    dailyNewLimit: 'New words a day',
    dailyNewLimitWords: (n: string) => `${n} words / day`,
    strictAccents: 'Accents count',
    strictAccentsHint: 'A missing accent (á, é, ñ) is a mistake when typing.',
    articlePicker: 'Article buttons',
    articlePickerHint: 'On Spanish noun cards you pick el/la/los/las instead of typing it. ⊘ means no article.',
    // return time of a PCIC "again" card.
    missedWordDelay: 'Missed word comes back after',
    missedWordDelaySeconds: (n: string) => `${n} s`,
    // the row that switches the learning direction + its
    // sheet (Settings, above the Backup row).
    learningDirection: 'Learning direction',
    chooseDirection: 'Choose learning direction',
    directionEnEs: 'English → Spanish',
    directionEsEn: 'Spanish → English',
    credits: 'Credits',
    // the row that resets the grammar progress, and its confirmation.
    resetGrammar: '🗑️ Reset grammar progress',
    resetGrammarTitle: 'Reset grammar progress',
    resetGrammarMessage: 'This clears all grammar lesson and practice progress. Are you sure?',
    // the restart rows in a collapsible section.
    resetSection: '🗑️ Restart progress',
    // the __DEV__-only exam control (visible only in a development build).
    devSeedExamA1: 'DEV: set up the exam state (A1-B2)',
    devSeedExamA1Done: 'DEV: exam state is set (A1-B2), open the level sheet',
  },
  // theme (skin) names and group names for the Settings theme grid.
  skins: {
    names: {
      brutal: 'Neo-brutal',
      deco: 'Art deco',
      loteria: 'Lotería',
      senior: 'Senior',
      konnyu: 'Easy reading',
      retro95: 'Retro 95',
      y2k: 'Y2K',
      kawaii: 'Kawaii',
      gamer: 'Gamer',
      botanikus: 'Botanical',
      zen: 'Zen',
      diszlexia: 'Dyslexia font',
      szocreal: 'Socialist realism',
      plakat: 'Poster',
      csillampony: 'Glitter pony',
      bauhaus: 'Bauhaus',
      popart: 'Pop art',
      szecesszio: 'Art nouveau',
      kalocsai: 'Kalocsa folk',
      memphis: 'Memphis',
      kodex: 'Codex',
      graffiti: 'Graffiti',
      ukiyoe: 'Ukiyo-e',
      classic: 'Classic',
      mix: 'My mix',
    },
    groups: {
      ajanlott: 'Recommended',
      muveszet: 'Art movements',
      kultura: 'Culture',
      hangulat: 'Mood',
      olvasas: 'Easy reading',
    },
  },
  backup: {
    backup: 'Backup',
    restore: 'Restore',
    confirmTitle: 'Restore',
    confirmMessage: 'This overwrites your current progress with the backup contents. Are you sure?',
    confirmYes: 'Restore now',
    doneTitle: 'Restored!',
    errorTitle: 'Error',
    exportError: 'The backup could not be created.',
    importError: 'Invalid or corrupted backup file. Your data was not changed.',
  },
  // the "Hibáim" import (Settings), report and practice deck.
  mistakes: {
    load: '📥 Load my mistakes',
    loaded: (sentences: number, words: number, drills: number) =>
      `Loaded: ${sentences} sentences, ${words} words, ${drills} grammar drills`,
    entry: (n: number) => `📕 My mistakes (${n})`,
    title: 'My mistakes',
    practice: (n: number) => `Practice my mistakes (${n} due)`,
    empty: 'No mistakes loaded yet. Settings → Load my mistakes.',
    wrongWordsTitle: 'Words you got wrong',
    reviewAgainTitle: 'Review again',
    noLesson: 'No lesson in the app, the deck drills it',
    doubtfulTitle: 'Not in the deck (correction uncertain)',
    youSaid: 'You said:',
    chipSentence: 'Sentence',
    chipWord: 'Word',
    chipGrammar: 'Grammar',
    allDone: 'All done for now',
  },
  progress: {
    wordsKnown: 'Words known',
  },
  // the small tag on top of every card.
  // Play cut: the Learn tab's header (three numbers +
  // focus session) is gone; levelProgress stays, Stats still uses it.
  // Play cut: close had no caller left either, removed.
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} words`,
  },
  // word-data attribution screen, opened from Settings.
  credits: {
    title: 'Credits',
    cefrjBody:
      'English B1 word list: The CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo ' +
      'University of Foreign Studies (cefr-j.org). Used under its terms for research and ' +
      'commercial use with attribution.',
    cefrjLabel: 'github.com/openlanguageprofiles/olp-en-cefrj',
    cefrjUrl: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    fontsBody:
      'Fonts used by the app themes. All are open source: SIL Open Font License 1.1, ' +
      'except Permanent Marker (Apache License 2.0).',
    photosBody:
      'Photos on some cards come from Wikimedia Commons. Each photo is credited on its card, ' +
      'with author and license.',
    privacyLabel: 'Privacy policy',
    privacyUrl: 'https://kalmi91.github.io/kimacha/privacy-policy.html',
  },
  feedback: {
    button: 'Feedback',
    placeholder: 'Share your thoughts...',
    send: 'Send',
    cancel: 'Cancel',
    thanks: 'Thank you!',
  },
  usage: {
    plusOneMinute: '+1 minute wooo!',
    milestoneSession: '🔥 Wow, {min} minutes in one go!',
    milestoneDaily: '🎉 {min} minutes today, you are doing great!',
    // past the first hour, every quarter of an hour, random line.
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
    dailyGoalReached: (goal: number) => `Daily goal reached! ${goal} XP`,
    // midnight rollover, the finished day's stats plus a celebration.
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
    title: 'Usage stats',
    today: 'Today',
    thisWeek: 'This week',
    allTime: 'All-time total',
    bestDay: 'Best day',
    daysActive: 'Days active',
    minutes: (n: number) => `${n} min`,
    last7Days: 'Last 7 days',
    weeklyGoal: 'Weekly goal',
    goalProgress: (done: string, goal: string) => `${done} / ${goal} hours`,
    goalBehind: (left: string) => `⚠️ ${left} hours left to your goal`,
    goalReached: '🏆 Weekly goal reached!',
    noData: 'No usage yet, go learn something!',
    learningProgress: 'Learning progress',
    reviewsToday: 'Reviews today',
    // "known" = interval >= 21 days, "graduated" =
    // passed the learning steps (lib/pcicStats.ts).
    known21: 'Known (21+ days)',
    graduatedLabel: 'Learning → graduated',
    knownAtLevel: (level: string, known: number) => `${level} ${known}`,
    // how many words are put away for how long, and when they come back
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
    scheduleNextDays: (days: number) => `in ${days} ${days === 1 ? 'day' : 'days'}`,
    scheduleEmpty: 'Nothing put away yet, learn a few words!',
  },
  // the PCIC tab (English -> Spanish typing, Anki buttons).
  pcic: {
    // the four separate labels of the BadgeRow chip line.
    badgeTotal: (n: number) => `${n} words`,
    badgeDue: (n: number) => `due ${n}`,
    badgeNew: (n: number) => `new ${n}`,
    badgeDone: (n: number) => `done ${n}`,
    // today's XP chip: "XP 20/50", and "XP 63 ✓" once the daily goal is reached.
    badgeXp: (xp: number, goal: number) => (xp >= goal ? `XP ${xp} ✓` : `XP ${xp}/${goal}`),
    badgeXpA11y: (xp: number, goal: number) => `XP today: ${xp} of ${goal}`,
    // today's introduction split into words/sentences +
    // today's full allowance (daily limit + the "+10" bonus), e.g. "today: 6 words · 4 sentences / 10".
    badgeIntroducedToday: (words: number, sentences: number, budget: number) =>
      `today: ${words} word${words === 1 ? '' : 's'} · ${sentences} sentence${sentences === 1 ? '' : 's'} / ${budget}`,
    // T1 only shows again/good (index.tsx GRADES), but `s.pcic[g]` indexes by
    // the full Sm2Grade type, so hard/easy stay for TS even though unreachable.
    again: "Didn't know",
    hard: 'Hard',
    good: 'Knew it',
    easy: 'Easy',
    doneTitle: 'Done for today',
    resetConfirmTitle: 'Reset progress',
    resetConfirmYes: 'Reset',
    // the Settings row, with the name of the level being reset.
    resetRow: (level: string) => `🗑️ Reset progress (${level})`,
    resetConfirmLevel: (level: string) => `This clears all progress on the ${level} deck. Are you sure?`,
    undo: 'Undo',
    dontLearn: "Don't learn this",
    learningStep: (step: number, total: number) => `step ${step}/${total}`,
    newBadge: 'new',
    moreNew: (n: number) => `+${n} new words`,
    moreNewShort: (n: number) => `+${n}`,
    moreNewHint: 'More new words today?',
    tileAnswered: 'Answered',
    tileNew: 'New',
    tileAgain: 'Again',
    introduced: (n: number, total: number) => `${n} / ${total} words introduced`,
    // commit: the interval preview of the button row (previously hard-coded
    // in Hungarian in sm2Preview of lib/sm2.ts, for every language).
    intervalToday: '<1 day',
    intervalDays: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    // Level picker + Next.
    chooseLevel: 'Choose level',
    next: (label: string) => `Next → ${label}`,
    accentForgiven: 'Missing accent, counted as correct',
    // label of the "also: b · c" line after Check (slash answer).
    alsoLabel: 'also',
    // accessibility label of the (i) explanation button.
    noteLabel: 'More info',
    // the source line of the card's image (Wikimedia Commons).
    photoCredit: (author: string, license: string, cropped: boolean) => `Photo: ${author}, ${license}, Wikimedia Commons${cropped ? ' (cropped)' : ''}`,
    photoCreditHint: 'Opens the photo page on Wikimedia Commons',
    // labels and rows of the level-picker sheet (previously hard-coded in English
    // in LEVEL_LABELS of data/pcic.ts and in components/LevelRow.tsx).
    levelBeginner: 'Beginner',
    levelElementary: 'Elementary',
    levelIntermediate: 'Intermediate',
    levelUpperIntermediate: 'Upper intermediate',
    levelAdvanced: 'Advanced',
    levelNotStarted: 'not started',
    levelRowIntroduced: (n: number, total: number) => `${n} / ${total} introduced`,
  },
  // labels of the end-of-lesson grammar quiz.
  lessonTest: {
    take: 'Take the lesson test',
    rules: (n: number, pct: number) => `${n} ${n === 1 ? 'question' : 'questions'}, pass ${pct}%`,
    finishFirst: 'Finish all practice types first',
    passedTag: 'Test passed',
    passedBest: (best: number) => `Test passed · best ${best}%`,
    verdictPassed: 'Lesson test passed',
    leaveTitle: 'Leave the test',
    missedTitle: 'Missed questions',
    whyHeading: 'Why is the sentence like this?',
  },
  // labels of the level exam (level-picker row,
  // intro, questions, result). The UI never shows the exam's official name anywhere.
  exam: {
    rowTitle: (level: string) => `${level} level exam`,
    rowLocked: (learned: number, needed: number, missing: number) => `${learned} / ${needed} words learned, ${missing} to go`,
    rowNeedLesson: (level: string) => `Finish one ${level} grammar lesson to unlock`,
    rowReady: 'Ready',
    rowPassed: (best: number) => `Passed · best ${best}%`,
    rowBest: (best: number) => `Best ${best}%`,
    practiceWords: 'Practice words',
    openGrammar: 'Grammar lessons',
    title: (level: string) => `${level} level exam`,
    introWords: (n: number) => `Words: ${n} ${n === 1 ? 'question' : 'questions'}`,
    introGrammar: (n: number) => `Grammar: ${n} ${n === 1 ? 'question' : 'questions'}`,
    introReading: (n: number) => `Reading: ${n} ${n === 1 ? 'question' : 'questions'}`,
    introRules: 'No lives. If you miss one, the right answer is shown.',
    introPass: (pct: number) => `Pass: ${pct}% overall`,
    start: 'Start exam',
    notNow: 'Not now',
    question: (i: number, n: number) => `Question ${i} / ${n}`,
    leaveTitle: 'Leave the exam',
    leaveBody: 'Your answers so far are not saved.',
    leave: 'Leave',
    keepGoing: 'Keep going',
    dontKnow: "I don't know",
    buildSentence: 'Build the sentence',
    matchPairs: 'Match the pairs',
    chooseGap: 'Choose the word that fits',
    readText: 'Read the text, then choose what it says.',
    correctAnswer: 'Correct answer',
    passedTitle: (level: string) => `${level} passed`,
    notYet: 'Not yet',
    score: (correct: number, total: number, pct: number) => `${correct} / ${total} · ${pct}%`,
    needPass: (pct: number) => `You need ${pct}% to pass.`,
    continueTo: (level: string) => `Continue to ${level}`,
    tryAgain: 'Try again',
    exit: 'Exit',
    lockedTitle: 'Level exam locked',
    lockedBody: 'Learn more words and finish a grammar lesson first.',
    emptyBody: 'There is not enough material for the exam yet.',
    back: 'Back',
    // the result per skill; for the weak points a link to the lesson / the words.
    skillWords: 'Words',
    skillGrammar: 'Grammar',
    skillReading: 'Reading',
    skillStrong: 'Strong',
    skillWeak: 'Weak',
    skillReviewLesson: (title: string) => `Review lesson: ${title}`,
    skillReviewWords: 'Review these words',
    skillPracticeSentences: 'Practice sentences',
    // spoken item dictated with the keyboard's microphone.
    introSpeaking: (n: number) => `Speaking: ${n} ${n === 1 ? 'question' : 'questions'}`,
    skillSpeaking: 'Speaking',
    speakTranslate: (lang: string): string => (lang === 'es' ? 'Say it in Spanish' : 'Say it in English'),
    speakRepeat: 'Read it aloud',
    speakHint: 'Tap the microphone on your keyboard and say the sentence. Your words appear in the box.',
    speakPlaceholder: 'Your spoken words appear here',
    speakYouSaid: 'You said',
  },
  // labels of the adaptive level assessment
  // (entry on the level picker, questions, result).
  placement: {
    entry: 'Not sure? Take the 3-minute placement test',
    question: (i: number) => `Question ${i}`,
    wordQuestion: (word: string) => `What does «${word}» mean?`,
    dontKnow: "I don't know",
    leaveTitle: 'Leave the placement test',
    leaveBody: 'Your answers so far are not saved.',
    suggestedStart: (level: string) => `Suggested start: ${level}`,
    levelScore: (level: string, correct: number, asked: number) => `${level} ${correct}/${asked}`,
    levelNote: {
      A1: 'You are at the very start: the first words and sentences are next.',
      A2: 'You manage the everyday basics: time to widen them.',
      B1: 'You cope with most everyday situations: polish the details.',
      B2: 'You are at ease with the language: rarer words and finer grammar are next.',
      C1: 'You handle the language with confidence: formal, written and abstract vocabulary is next.',
    },
    knownWords: (n: number) => `${n} ${n === 1 ? 'word' : 'words'} you already know will not come back as new.`,
    startAt: (level: string) => `Start at ${level}`,
    chooseOther: 'Choose another level',
    again: 'Take it again',
    emptyBody: 'There is not enough material for a placement test yet.',
  },
  // part-of-speech chip under the PCIC word (lib/pcicPos.ts).
  // The label of the full WordPos set (not only noun/verb/phrase),
  // + conj/det/interj for the PCIC-only Pos values.
  pos: {
    noun: 'noun',
    verb: 'verb',
    adj: 'adjective',
    adv: 'adverb',
    pron: 'pronoun',
    prep: 'preposition',
    num: 'number',
    phrase: 'phrase',
    conj: 'conjunction',
    det: 'determiner',
    interj: 'interjection',
  },
  // the practice exam (Stats "Practice exam"
  // card, intro, papers, result, review). The UI never shows a trademarked exam name anywhere.
  mockExam: {
    cardTitle: 'Practice exam',
    cardBody: 'A full practice exam in the official format: reading, listening, writing and speaking.',
    cardBodyIntl: 'A full practice exam modeled on an international format: reading, listening, writing and speaking.',
    cardLast: (level: string, passed: boolean, date: string) => `Last result ${level}: ${passed ? 'passed' : 'not passed'}, ${date}`,
    cardInProgress: (level: string) => `${level} exam in progress`,
    title: (level: string) => `${level} practice exam`,
    modelNote: (level: string) => `Modeled on the official ${level} exam format`,
    modelNoteIntl: (level: string) => `Practice exam modeled on an international ${level} format`,
    paperLine: (name: string, minutes: number, tasks: number, points: number) =>
      `${name}: ${minutes} min, ${tasks} ${tasks === 1 ? 'task' : 'tasks'}, ${points} points`,
    paperLineSoon: (name: string, minutes: number) => `${name}: ${minutes} min, microphone part coming soon`,
    passRule: (needed: number, of: number) => `To pass: at least ${needed} of ${of} points in both groups`,
    passRuleTotal: (needed: number, of: number) => `To pass: at least ${needed} of ${of} points in total. One skill can make up for another.`,
    passRuleAverage: (pct: number) =>
      `To pass: an average of about ${pct}% across the skills. This pass line is an estimate, the real exam does not publish one.`,
    shortNote: 'Shorter than the real exam, points are scaled. The clock is the real one.',
    unavailableBody: 'There is no practice exam for this level yet.',
    emptyBody: 'There is not enough material for this practice exam yet.',
    begin: 'Begin',
    resume: (n: number, total: number) => `Resume at paper ${n} of ${total}`,
    startOver: 'Start over',
    exit: 'Exit',
    paperOf: (i: number, n: number) => `Paper ${i} of ${n}`,
    paperMeta: (minutes: number, tasks: number, points: number) => `${minutes} min, ${tasks} ${tasks === 1 ? 'task' : 'tasks'}, ${points} points`,
    startPaper: 'Start paper',
    noVoice: 'No voice for this language is installed on this device. Use the transcript.',
    taskOf: (i: number, n: number) => `Task ${i} / ${n}`,
    nextTask: 'Next task',
    finishPaper: 'Finish paper',
    play: 'Play',
    playsLeft: (n: number) => `Plays left: ${n}`,
    showTranscript: 'Show transcript',
    hideTranscript: 'Hide transcript',
    speakerA: 'A',
    speakerB: 'B',
    recording: (n: number) => `Recording ${n}`,
    lineQuestion: (n: number) => `Line ${n}: what was said?`,
    whatSays: 'What does the text say?',
    whatHeard: 'What did you hear?',
    true_: 'True',
    false_: 'False',
    wordCount: (n: number, min: number) => `${n} / min ${min}`,
    glossaryShow: (n: number) => `Words you have not learned yet (${n})`,
    glossaryHide: 'Hide word list',
    hint: {
      read_mc: 'Read each short text and choose what it means.',
      match: 'Match each sentence with its meaning. There is one meaning too many.',
      true_false: 'Read the text. Mark each statement true or false.',
      gap_mc: 'Choose the word that fits each gap.',
      listen_mc: 'Listen to the sentences (twice) and choose what you heard.',
      listen_match: 'Listen (twice) and match each recording with its meaning. There is one meaning too many.',
      listen_dialogue: 'Listen to the conversation (twice) and choose what was said in each line.',
      form_fill: 'Fill in every field.',
      short_message: 'Write the message the task describes. Reach the minimum word count and cover every point.',
      gap_type: 'Type the missing word in each gap.',
      listen_fill: 'Listen and type the missing word in each gap.',
      dictation: 'Listen and write down exactly what you hear.',
    },
    speakingTitle: 'Speaking: microphone part coming soon',
    speakingBody: 'This part is not in your score yet. Group 2 is provisional: your listening points count double.',
    speakingBodyScaled: 'This part is not in your score yet. Your result is provisional and uses your other three skills.',
    continue: 'Continue',
    timeUp: 'Time is up. Unanswered questions score 0.',
    leaveTitle: 'Leave the exam',
    leaveBody: 'Finished papers are saved. The paper you are on starts again when you resume.',
    leave: 'Leave',
    keepGoing: 'Keep going',
    passed: 'Passed',
    notPassed: 'Not passed',
    provisionalNote: 'Provisional: the speaking part is not included yet.',
    provisionalNoteTotal: 'Provisional: the speaking part is not included yet, so the total is scaled from the other three skills.',
    provisionalNoteAverage: 'Provisional: the speaking part is not included yet, so the average uses the other three skills.',
    bandLine: (name: string, points: number, max: number) => `${name}: ${points} / ${max}`,
    bandNotIncluded: (name: string) => `${name}: not included`,
    groupLine: (i: number, points: number, of: number, needed: number, passed: boolean, provisional: boolean) =>
      `Group ${i}: ${points} / ${of}, needed ${needed}, ${passed ? 'passed' : 'not passed'}${provisional ? ' (provisional)' : ''}`,
    totalLine: (points: number, of: number, needed: number, passed: boolean, provisional: boolean) =>
      `Total: ${points} / ${of}, needed ${needed}, ${passed ? 'passed' : 'not passed'}${provisional ? ' (provisional)' : ''}`,
    averageLine: (pct: number, passPct: number, passed: boolean, provisional: boolean) =>
      `Average of the skills: ${pct}%, needed about ${passPct}% (estimate), ${passed ? 'passed' : 'not passed'}${provisional ? ' (provisional)' : ''}`,
    checkAnswers: 'Check answers',
    reviewTitle: 'Your answers',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    noAnswer: 'no answer',
    tryAgain: 'Try again',
    back: 'Back to the result',
  },
  // the table-deck screen (a lesson's conjugation
  // tables, practiced Anki-style with the PCIC card UI).
  tableDeck: {
    chip: 'TABLE',
    promptCaption: 'person · verb',
    // the word deck of table-less lessons
    // uses the same screen, only these two strings change.
    wordChip: 'WORD',
    wordPromptCaption: 'meaning',
    // in the es→en direction the question is the Spanish word, the answer is the English word.
    wordPromptCaptionEn: 'How do you say it in English?',
    // caption for a cell with an English prompt (translate to Spanish).
    promptCaptionEn: 'translate to Spanish',
    // on the conjugation card the infinitive is hidden, the hint button shows it.
    showVerb: 'Show the verb',
    progress: (done: number, total: number) => `${done} / ${total} done`,
    completeTitle: (n: number) => `All ${n} cells done 🎉`,
    startAgain: 'Start again',
    // a full pass, all cells shuffled, once
    // the plain (deck-order) "Start again" pass is done.
    harder: 'Harder: shuffled',
    backToLesson: 'Back to the lesson',
  },
};
