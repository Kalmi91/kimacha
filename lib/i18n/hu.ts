export default {
  onboarding: {
    whatLanguage: 'Milyen nyelven beszélsz?',
    selectSource: 'Válaszd ki az anyanyelved',
    whatLearn: 'Mit szeretnél tanulni?',
    selectTarget: 'Válaszd ki a célnyelvet',
    back: '← Vissza',
    pairNotAvailable: 'Ez a nyelvpár még nem elérhető. Hamarosan!',
  },
  card: {
    word: 'szó',
    sentence: 'mondat',
    tapToReveal: 'Koppints a fordításhoz',
    typeTranslation: 'Írd be a fordítást',
    typeIt: 'Begépelem',
    check: 'Ellenőrzés',
    correct: 'Helyes!',
    almostCorrect: 'Majdnem!',
    wrong: 'Hibás',
  },
  buttons: {
    again: 'Újra',
    good: 'Jó',
    inSentence: 'Mondatban',
    iKnowThis: 'Ezt Már Tudom',
  },
  done: {
    title: 'Kész vagy mára!',
    reviewed: (n: number) => `${n} kártyát néztél át.`,
    streak: 'nap streak',
  },
  tabs: {
    learn: 'Tanulás',
    active: 'Aktív',
    settings: 'Beállítások',
  },
  active: {
    title: 'Aktív mód',
    comingSoon: 'Hamarosan...',
    description: 'Beszélgess spanyolul egy NPC-vel.\nIter2-ben érkezik.',
  },
  exam: {
    tag: 'Vizsga',
    unlocked: 'Vizsga feloldva!',
    unlockedCta: 'Vizsga Megkezdése',
  },
  topic: {
    progress: (current: number, total: number) => `Téma ${current}/${total}`,
    complete: 'Téma kész!',
    allComplete: 'Minden téma kész!',
    next: (name: string) => `Következő: ${name}`,
    locked: 'Zárolva',
  },
  master: {
    button: 'Mester',
    title: 'Szint Választás',
  },
  settings: {
    changeLanguage: 'Nyelv Váltás',
  },
  progress: {
    wordsKnown: 'Ismert Szavak',
  },
  feedback: {
    button: 'Visszajelzés',
    placeholder: 'Írd le a véleményed...',
    send: 'Küldés',
    cancel: 'Mégse',
    thanks: 'Köszönjük!',
  },
};
