import type en from '../en/common';

const de: typeof en = {
  audio: {
    loading: 'Audio wird vorbereitet…',
    playing: 'Audio wird abgespielt…',
    noEngine: 'Auf diesem Gerät sind keine Sprachengine oder Stimmen verfügbar. Aktiviere die Sprachausgabe in den Geräte- oder Browsereinstellungen.',
    noVoice: 'Für diese Sprache ist keine Stimme installiert. Installiere sie in den Geräte- oder Browsereinstellungen.',
    failed: 'Audio konnte nicht abgespielt werden. Versuche es erneut oder prüfe die Spracheinstellungen des Geräts oder Browsers.',
  },
  onboarding: {
    welcome: 'Willkommen bei Kimacha! Danke, dass du die App benutzt, das bedeutet mir viel.',
    start: "Los geht's",
    learnTitle: 'Welche Sprache möchtest du lernen?',
  },
  intro: {
    title: 'So funktioniert es',
    start: "Los geht's",
    first: 'Eine Sprache zu lernen ist ein langer, schwerer Weg. Es wird harte Tage geben, aber jeder kann es schaffen, und du auch.',
    words: 'Wörter: auf Karten, jeden Tag ein kleiner Stapel.',
    grammar: 'Grammatik: kurze Lektionen, in denen du Sätze baust.',
    exam: 'Dann eine Prüfung: Zeig, was du kannst.',
    repetition: 'Wiederholung ist der Schlüssel: Ein Wort kommt genau dann zurück, wenn du es fast vergessen hast.',
    overdo:
      'Übertreib es nicht: Was heute neu ist, wird morgen zur Wiederholung. Viele neue Wörter heute = viel Arbeit morgen, wenn du vielleicht weniger Lust hast.',
    closing: 'Jeden Tag weißt du ein bisschen mehr als gestern.',
  },
  onboardingTheme: {
    title: 'Such dir ein Aussehen aus',
    know: 'Weiß ich',
    later: 'Später kannst du in den Einstellungen aus 24 wählen.',
    next: 'Weiter',
  },
  tabs: {
    settings: 'Einstellungen',
    grammar: 'Grammatik',
    stats: 'Statistik',
    board: 'Wochenrangliste',
    pcic: 'Lernen',
    practice: 'Üben',
    sentences: 'Sätze',
    speak: 'Sprechen',
    comingSoon: 'Bald verfügbar',
  },
  a11y: {
    back: 'Zurück',
    close: 'Schließen',
    speak: 'Audio abspielen',
    stopSpeaking: 'Audio stoppen',
    statusBarTint: 'Farbe der oberen Leiste ändern',
    weeklyGoal: { up: 'Wöchentliches Lernziel erhöhen', down: 'Wöchentliches Lernziel verringern' },
    dailyNewLimit: { up: 'Neue Wörter pro Tag erhöhen', down: 'Neue Wörter pro Tag verringern' },
    missedWordDelay: {
      up: 'Wartezeit, bis ein verpasstes Wort zurückkommt, verlängern',
      down: 'Wartezeit, bis ein verpasstes Wort zurückkommt, verkürzen',
    },
  },
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} Wörter`,
  },
  notFound: {
    title: 'Diese Seite gibt es nicht',
    back: 'Zurück zum Start',
  },
};

export default de;
