export default {
  onboarding: {
    welcome: 'Welcome to Kimacha! Thank you for using the app, it means a lot.',
    // Kimacha Play: single en-es pair, no more language
    // picker here, just a way to start the course.
    start: 'Get started',
    learnTitle: 'Which language do you want to learn?',
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
  tabs: {
    settings: 'Settings',
    grammar: 'Grammar',
    stats: 'Stats',
    pcic: 'Learn',
    // the two beta tabs (Settings -> Beta) and the line on their placeholder screens.
    practice: 'Practice',
    sentences: 'Sentences',
    comingSoon: 'Coming soon',
  },
  // accessibility labels (screen readers) of the controls that show only an icon or a symbol.
  a11y: {
    back: 'Back',
    close: 'Close',
    speak: 'Play audio',
    stopSpeaking: 'Stop audio',
    statusBarTint: 'Change the color of the top strip',
    // the −/+ of the Settings steppers, one full phrase each (a template over the row label reads badly)
    weeklyGoal: { up: 'Increase weekly study goal', down: 'Decrease weekly study goal' },
    dailyNewLimit: { up: 'Increase new words a day', down: 'Decrease new words a day' },
    missedWordDelay: {
      up: 'Increase the wait before a missed word comes back',
      down: 'Decrease the wait before a missed word comes back',
    },
  },
  // the small tag on top of every card.
  // Play cut: the Learn tab's header (three numbers +
  // focus session) is gone; levelProgress stays, Stats still uses it.
  // Play cut: close had no caller left either, removed.
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} words`,
  },
  // the router's 404 screen (app/+not-found.tsx).
  notFound: {
    title: 'This page does not exist',
    back: 'Back to start',
  },
};
