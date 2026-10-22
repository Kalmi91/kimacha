export default {
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
  // the Stats tab's level card (lib/progressLevel.ts): A1-C1, 80% of the words + every grammar topic.
  levelCard: {
    title: 'Your level',
    level: (level: string) => `Level ${level}`,
    heading: (level: string) => `Heading for ${level}`,
    top: 'You have cleared the top level.',
    goal: (level: string) => `To clear ${level}`,
    rule: (pct: number) => `${pct}% of the level's words learned and every grammar topic done.`,
    words: (known: number, needed: number, total: number, pct: number) => `Words learned: ${known} / ${needed} (${pct}% of ${total})`,
    grammar: (done: number, total: number) => `Grammar topics done: ${done} / ${total}`,
  },
  // the row under a level with no words yet (the es→en A1 until the English word list is ready):
  // the onboarding level step and the level picker sheet.
  wordList: {
    empty: 'No words here yet',
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
  // the Practice tab (beta): a short text of words that are due, questions about it, then the same words in sentences.
  practiceTab: {
    emptyTitle: 'Learn a few more words, then there will be something to read here',
    readAloud: 'Read aloud',
    progress: (n: number, total: number) => `${n}/${total}`,
    progressLabel: (n: number, total: number) => `Question ${n} of ${total}`,
    questionMeaning: (word: string) => `What does “${word}” mean in the text?`,
    questionTrueFalse: 'True or false, based on the text:',
    optionTrue: 'True',
    optionFalse: 'False',
    rightMeaning: (word: string, meaning: string) => `“${word}” means ${meaning}`,
    inText: 'This sentence is in the text.',
    notInText: 'This sentence is not in the text.',
    questionsDone: 'Questions done',
    practiceSentences: 'Practice these words in sentences',
    newReading: 'New reading',
    // the mode chips on top of the tab (components/practice/modes.ts): Reading plus every game that is switched on.
    modesLabel: 'Practice mode',
    modeReading: 'Reading',
    modeDictation: 'Dictation',
    modeScramble: 'Scramble',
    modeMatch: 'Match',
    modeOpposites: 'Opposites',
    // shared by the games (lib/practice/useGameRound.ts, components/practice/GameFrame.tsx)
    game: {
      emptyTitle: 'Learn a few more words, then there will be something to practice here',
      progressLabel: (n: number, total: number) => `Word ${n} of ${total}`,
      roundDone: 'Round done',
      score: (n: number, total: number) => `${n} of ${total} right first time`,
      newRound: 'New round',
    },
    match: {
      boardLabel: (n: number, total: number) => `Table ${n} of ${total}`,
      timeLeft: (sec: number) => `${sec} s left`,
      timeUp: 'Time is up',
      allFound: 'All pairs found',
      result: (found: number, total: number, sec: number) => `${found} of ${total} pairs, ${sec} s`,
      best: (sec: number) => `Best time: ${sec} s`,
    },
    opposites: {
      prompt: 'What is the opposite?',
      empty: 'Learn more words to unlock opposites',
      answer: (word: string) => `The opposite: ${word}`,
      listen: 'Listen',
    },
    scramble: {
      emptySlot: 'Empty place',
      mistakes: (n: number) => `Mistakes: ${n}`,
      skip: 'Skip',
      solution: 'Solution',
      noHalf: (n: number) => (n === 1 ? '1 mistake, no half this time' : `${n} mistakes, no half this time`),
      listen: 'Listen',
    },
    dictation: {
      listen: 'Listen',
      listenAgain: 'Listen again',
      means: (meaning: string) => `Means: ${meaning}`,
    },
  },
  // Sentences tab (beta): header progress (steps: every build plus the one typing), the build and the typing step, empty and round-done states.
  sentenceTab: {
    progress: (done: number, total: number) => `${done} / ${total}`,
    progressA11y: (done: number, total: number) => `Steps done: ${done} of ${total}`,
    stepBuild: (n: number, total: number) => `Build the sentence ${n} of ${total}`,
    stepType: 'Last step: type this sentence',
    // Listening build (beta sentenceListening): the prompt is heard, not shown, until the build is right.
    stepListen: (n: number, total: number) => `Listen and build the sentence ${n} of ${total}`,
    listenHint: 'Listen, then build the sentence',
    listenPlay: 'Play the sentence',
    // Mistake build (beta sentenceMistakes): a sentence from the learner's own "My mistakes" list.
    fromMistakes: 'From your mistakes',
    empty: 'Learn more words to unlock sentences',
    roundDone: (n: number) => (n === 1 ? 'Round done: 1 sentence' : `Round done: ${n} sentences`),
    more: 'More sentences',
  },
  // components/practice/LevelCounter.tsx (Sentences and Practice tabs): the level and its word counts, same chips as the Words tab.
  levelCounter: {
    a11y: (level: string, total: number, due: number) => `Level ${level}: ${total} words, ${due} due`,
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
