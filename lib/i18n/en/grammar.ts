export default {
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
};
