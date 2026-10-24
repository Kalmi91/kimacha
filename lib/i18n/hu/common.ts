import type en from '../en/common';

const hu: typeof en = {
  onboarding: {
    welcome: 'Üdv a Kimachában! Köszönöm, hogy használod az appot, sokat jelent.',
    start: 'Kezdjük',
    learnTitle: 'Milyen nyelvet szeretnél tanulni?',
  },
  intro: {
    title: 'Így működik',
    start: 'Kezdjük',
    first: 'A nyelvtanulás hosszú, nehéz út. Lesznek nehéz napok, de mindenki meg tudja csinálni, és te is.',
    words: 'Szavak: kártyákon, minden nap egy kis adag.',
    grammar: 'Nyelvtan: rövid leckék, ahol mondatokat építesz.',
    exam: 'Aztán egy vizsga: mutasd meg, mit tudsz.',
    repetition: 'Az ismétlés a kulcs: a szó pont akkor jön vissza, amikor már majdnem elfelejted.',
    overdo:
      'Ne vidd túlzásba: ami ma új, az holnap ismétlés. Sok új szó ma = sok munka holnap, amikor talán kevesebb kedved lesz hozzá.',
    closing: 'Minden nap egy kicsit többet fogsz tudni, mint tegnap.',
  },
  onboardingTheme: {
    title: 'Válassz egy stílust',
    know: 'Tudom',
    later: 'Később 24 közül választhatsz a Beállításokban.',
    next: 'Tovább',
  },
  tabs: {
    settings: 'Beállítások',
    grammar: 'Nyelvtan',
    stats: 'Statisztika',
    pcic: 'Tanulás',
    practice: 'Gyakorlás',
    sentences: 'Mondatok',
    comingSoon: 'Hamarosan',
  },
  a11y: {
    back: 'Vissza',
    close: 'Bezárás',
    speak: 'Hang lejátszása',
    stopSpeaking: 'Hang leállítása',
    statusBarTint: 'A felső sáv színének módosítása',
    weeklyGoal: { up: 'Heti tanulási cél növelése', down: 'Heti tanulási cél csökkentése' },
    dailyNewLimit: { up: 'Napi új szavak számának növelése', down: 'Napi új szavak számának csökkentése' },
    missedWordDelay: {
      up: 'Az elrontott szó visszatérése előtti várakozás növelése',
      down: 'Az elrontott szó visszatérése előtti várakozás csökkentése',
    },
  },
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} szó`,
  },
  notFound: {
    title: 'Ez az oldal nem létezik',
    back: 'Vissza a kezdőlapra',
  },
};

export default hu;
