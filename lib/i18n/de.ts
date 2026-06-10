export default {
  onboarding: {
    whatLanguage: 'Welche Sprache sprichst du?',
    selectSource: 'Wähle deine Muttersprache',
    whatLearn: 'Was möchtest du lernen?',
    selectTarget: 'Wähle die Zielsprache',
    back: '← Zurück',
    pairNotAvailable: 'Dieses Sprachpaar ist noch nicht verfügbar. Bald!',
  },
  card: {
    word: 'Wort',
    sentence: 'Satz',
    tapToReveal: 'Tippe zum Übersetzen',
    typeTranslation: 'Gib die Übersetzung ein',
    typeIt: 'Eintippen',
    check: 'Prüfen',
    correct: 'Richtig!',
    almostCorrect: 'Fast!',
    wrong: 'Falsch',
  },
  buttons: {
    again: 'Nochmal',
    good: 'Gut',
    inSentence: 'Im Satz',
    iKnowThis: 'Kann Ich Schon',
  },
  done: {
    title: 'Fertig für heute!',
    reviewed: (n: number) => `${n} Karten überprüft.`,
    streak: 'Tage Serie',
  },
  tabs: {
    learn: 'Lernen',
    active: 'Aktiv',
    settings: 'Einstellungen',
  },
  active: {
    title: 'Aktiver Modus',
    comingSoon: 'Bald verfügbar...',
    description: 'Führe ein Gespräch auf Spanisch.\nKommt in einem zukünftigen Update.',
  },
  exam: {
    tag: 'Prüfung',
    unlocked: 'Prüfung freigeschaltet!',
    unlockedCta: 'Prüfung Starten',
  },
  topic: {
    progress: (current: number, total: number) => `Thema ${current}/${total}`,
    complete: 'Thema abgeschlossen!',
    allComplete: 'Alle Themen abgeschlossen!',
    next: (name: string) => `Nächstes: ${name}`,
    locked: 'Gesperrt',
  },
  subLevel: {
    progress: (id: string, name: string, current: number, total: number) => `${id} · ${name} — ${current}/${total}`,
    complete: (id: string, name: string) => `${id} abgeschlossen: ${name}! 🎉`,
    doneProgress: (done: number, total: number) => `${done}/${total} Themen fertig in dieser Stufe`,
  },
  master: {
    button: 'Meister',
    title: 'Stufe Wählen',
  },
  settings: {
    changeLanguage: 'Sprache Wechseln',
  },
  progress: {
    wordsKnown: 'Bekannte Wörter',
  },
  feedback: {
    button: 'Feedback',
    placeholder: 'Teile deine Meinung...',
    send: 'Senden',
    cancel: 'Abbrechen',
    thanks: 'Danke!',
  },
};
