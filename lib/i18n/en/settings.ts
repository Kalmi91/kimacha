export default {
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
    // Settings -> Beta: early features, each one a switch; off = the app works as before.
    beta: {
      title: 'Beta',
      practiceTab: 'Practice tab',
      sentenceTab: 'Sentences tab',
      xpV2: 'New XP values',
      levels: 'Levels A1-C1',
      practiceDictation: 'Dictation game',
      practiceScramble: 'Letter scramble game',
    },
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
    errorTitle: 'Could not send. Please try again.',
  },
};
