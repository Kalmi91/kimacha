// PLAN-vizsga E. szakasz (15-16. lépés, Kálmán 2026-10-01): a próbavizsga képernyőjének folyamata.
// A feladatsor-építő mockolt (a tartalmát lib/exam/mock/__tests__/build.test.ts fedi), itt a
// folyamat: intro, papíronként óra és feladatok (nincs azonnali visszajelzés), a hallás 2
// lejátszása, a szóbeli helyőrző (2. csoport = hallás x2, provisional), eredmény mentése,
// félbehagyott vizsga folytatása (papíronként mentve), lejáró óra, szójegyzet ismeretlen szóra.
// Mock-minta: app/__tests__/exam.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockBack = jest.fn();
let mockLevel = 'A1';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: mockLevel }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  stopSpeaking: jest.fn(),
  loadVoices: jest.fn().mockResolvedValue(undefined),
  hasVoiceFor: jest.fn(() => true),
}));

import type { MockExam } from '@/lib/exam/mock/types';

const baseExam = (): MockExam => ({
  target: 'es',
  level: 'A1',
  seed: 1,
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
  papers: [
    {
      skill: 'reading',
      name: 'Comprensión de lectura',
      minutes: 45,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'reading-1',
          kind: 'read_mc',
          instruction: 'TAREA 1. Lea los textos y marque la opción correcta.',
          passages: [{ text: 'Tengo un perro. Es grande.', options: ['I have a dog. It is big.', 'I have a cat. It is big.', 'I have a dog. It is small.'], correct: 0 }],
        },
      ],
    },
    {
      skill: 'writing',
      name: 'Expresión e interacción escritas',
      minutes: 25,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'writing-1',
          kind: 'short_message',
          instruction: 'TAREA 1. Escriba un texto.',
          prompt: 'Escriba un mensaje a un amigo.',
          minWords: 3,
          points: [{ id: 'name', label: 'Dice su nombre', keywords: ['me llamo'] }],
        },
      ],
    },
    {
      skill: 'listening',
      name: 'Comprensión auditiva',
      minutes: 25,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'listening-1',
          kind: 'listen_mc',
          instruction: 'TAREA 1. Va a escuchar unas frases.',
          audio: ['Tengo un perro.'],
          questions: [{ options: ['I have a dog.', 'I have a cat.', 'I have a car.'], correct: 0 }],
        },
      ],
    },
    { skill: 'speaking', name: 'Expresión e interacción orales', minutes: 10, points: 25, placeholder: true, tasks: [] },
  ],
});

let mockExam: MockExam = baseExam();
jest.mock('@/lib/exam/mock/build', () => ({
  ...jest.requireActual('@/lib/exam/mock/build'),
  buildMockExam: (input: { seed: number }) => ({ ...mockExam, seed: input.seed }),
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { singleWordForm } from '@/lib/exam/mock/build';
import { MOCK_EXAM_PROGRESS_KEY, readMockOverview } from '@/lib/exam/mock/session';
import { setLanguage, t } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import { sm2NewCard } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockExamScreen from '../mock-exam';

jest.setTimeout(60000);

const flush = async (times = 10) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

type Screen = ReturnType<typeof render>;

const mount = async (): Promise<Screen> => {
  const view = render(
    <ThemeProvider>
      <MockExamScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

// Az óra másodperces tickjei ne fussanak a tesztek közben (act-figyelmeztetés); a lejárat külön teszt.
const reset = async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockBack.mockClear();
  (speak as jest.Mock).mockClear();
  mockLevel = 'A1';
  mockExam = baseExam();
  setPcicTarget('es');
  await getDb().setOnboarding('en', 'es');
  await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  await getDb().resetPcicCards();
};

// A három kitöltendő papír helyes megoldása (olvasás, írás, hallás), a szóbeli helyőrzővel.
const solveReading = async (s: Screen) => {
  await press(s, 'mock-start-paper');
  await press(s, 'mock-option-r0-0');
  await press(s, 'mock-next-task');
};
const solveWriting = async (s: Screen) => {
  await press(s, 'mock-start-paper');
  fireEvent.changeText(s.getByTestId('mock-message'), 'Me llamo Ana y vivo aqui');
  await press(s, 'mock-next-task');
};
const solveListening = async (s: Screen) => {
  await press(s, 'mock-start-paper');
  await press(s, 'mock-option-l0-0');
  await press(s, 'mock-next-task');
};

afterEach(() => {
  jest.useRealTimers();
});

describe('Próbavizsga: folyamat (E1-E5)', () => {
  beforeEach(reset);

  it('intro: négy papír a hivatalos percekkel, a szóbeli "hamarosan", átmenési szabály, rövidítés-megjegyzés', async () => {
    const s = await mount();
    expect(s.getByText('A1 practice exam')).toBeTruthy();
    expect(s.getByText('Modeled on the official A1 exam format')).toBeTruthy();
    expect(s.getByText('Comprensión de lectura: 45 min, 1 task, 25 points')).toBeTruthy();
    expect(s.getByText('Comprensión auditiva: 25 min, 1 task, 25 points')).toBeTruthy();
    expect(s.getByText('Expresión e interacción orales: 10 min, microphone part coming soon')).toBeTruthy();
    expect(s.getByText('To pass: at least 30 of 50 points in both groups')).toBeTruthy();
    expect(s.getByText(/Shorter than the real exam/)).toBeTruthy();
    expect(s.queryByText(/DELE/i)).toBeNull();
    s.unmount();
  });

  it('végigvitel: papír-intro, óra, nincs azonnali jelzés, szóbeli helyőrző, eredmény (hallás x2, provisional), mentés', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    expect(s.getByText('Paper 1 of 4')).toBeTruthy();
    expect(s.getByText('45 min, 1 task, 25 points')).toBeTruthy();

    await press(s, 'mock-start-paper');
    expect(s.getByText('⏱ 45:00')).toBeTruthy();
    expect(s.getByText('Task 1 / 1')).toBeTruthy();
    await press(s, 'mock-option-r0-1'); // rossz válasz
    expect(s.queryByText(t().games.correctFeedback)).toBeNull(); // nincs azonnali visszajelzés
    expect(s.queryByText(t().games.wrongFeedback)).toBeNull();
    await press(s, 'mock-option-r0-0');
    await press(s, 'mock-next-task');

    expect(s.getByText('Paper 2 of 4')).toBeTruthy();
    await solveWriting(s);

    expect(s.getByText('Paper 3 of 4')).toBeTruthy();
    await solveListening(s);

    expect(s.getByText('Paper 4 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText('Speaking: microphone part coming soon')).toBeTruthy();
    await press(s, 'mock-speaking-continue');

    expect(s.getByText('Passed')).toBeTruthy();
    expect(s.getByText('Comprensión de lectura: 25 / 25')).toBeTruthy();
    expect(s.getByText('Expresión e interacción orales: not included')).toBeTruthy();
    expect(s.getByText('Group 1: 50 / 50, needed 30, passed')).toBeTruthy();
    expect(s.getByText('Group 2: 50 / 50, needed 30, passed (provisional)')).toBeTruthy();
    expect(s.getByText('Provisional: the speaking part is not included yet.')).toBeTruthy();

    const overview = await readMockOverview(getDb(), 'es', ['A1']);
    expect(overview.A1?.last).toMatchObject({ passed: true, provisional: true });
    expect(overview.A1?.session).toBeUndefined();
    s.unmount();
  });

  it('átnézés: tételenként a kérdés, a te válaszod, a helyes válasz; "Try again" új intro-ra visz', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-option-r0-1'); // rossz
    await press(s, 'mock-next-task');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-next-task'); // üres írás
    await press(s, 'mock-start-paper');
    await press(s, 'mock-next-task'); // üres hallás
    await press(s, 'mock-start-paper');
    await press(s, 'mock-speaking-continue');
    expect(s.getByText('Not passed')).toBeTruthy();

    await press(s, 'mock-review');
    expect(s.getByText('Your answers')).toBeTruthy();
    expect(s.getByText('✗ Tengo un perro. Es grande.')).toBeTruthy();
    expect(s.getByText('Your answer: I have a cat. It is big.')).toBeTruthy();
    expect(s.getByText('Correct answer: I have a dog. It is big.')).toBeTruthy();
    await press(s, 'mock-review-back');
    await press(s, 'mock-retry');
    expect(s.getByTestId('mock-begin')).toBeTruthy();
    s.unmount();
  });

  it('hallás: legfeljebb 2 lejátszás, a harmadik koppintás néma', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    await solveReading(s);
    await solveWriting(s);
    await press(s, 'mock-start-paper');
    expect(s.getByText('Plays left: 2')).toBeTruthy();
    await press(s, 'mock-play');
    expect(s.getByText('Plays left: 1')).toBeTruthy();
    // A mock-olt hang azonnal "kész", ezért a zár magától feloldódik: a 2. lejátszás mehet.
    const speakMock = speak as jest.Mock;
    speakMock.mock.calls[0][2].onDone?.();
    await press(s, 'mock-play');
    expect(s.getByText('Plays left: 0')).toBeTruthy();
    speakMock.mock.calls[1][2].onDone?.();
    await press(s, 'mock-play');
    expect(speakMock).toHaveBeenCalledTimes(2);
    s.unmount();
  });
});

describe('Próbavizsga: részenkénti mentés és folytatás (E4 b)', () => {
  beforeEach(reset);

  it('félbehagyás után a kész papír válasza megmarad, a folytatás a következő papírnál indul', async () => {
    const first = await mount();
    await press(first, 'mock-begin');
    await solveReading(first); // olvasás kész, helyes
    expect(first.getByText('Paper 2 of 4')).toBeTruthy();
    await press(first, 'mock-start-paper');
    await press(first, 'mock-close');
    expect(first.getByText('Leave the exam')).toBeTruthy();
    await press(first, 'mock-leave');
    expect(mockBack).toHaveBeenCalled();
    first.unmount();

    const overview = await readMockOverview(getDb(), 'es', ['A1']);
    expect(overview.A1?.session?.done).toEqual(['reading']);

    const second = await mount();
    expect(second.getByText('Resume at paper 2 of 4')).toBeTruthy();
    await press(second, 'mock-resume');
    expect(second.getByText('Paper 2 of 4')).toBeTruthy();
    await press(second, 'mock-start-paper');
    await press(second, 'mock-next-task'); // üres írás
    await solveListening(second);
    await press(second, 'mock-start-paper');
    await press(second, 'mock-speaking-continue');
    // Az olvasás a mentett (helyes) válaszból 25 pont, az írás üres = 0: az 1. csoport 25 / 50, bukás.
    expect(second.getByText('Comprensión de lectura: 25 / 25')).toBeTruthy();
    expect(second.getByText('Expresión e interacción escritas: 0 / 25')).toBeTruthy();
    expect(second.getByText('Not passed')).toBeTruthy();
    second.unmount();
  });

  it('"Start over" törli a mentést, és elölről indít', async () => {
    const first = await mount();
    await press(first, 'mock-begin');
    await solveReading(first);
    first.unmount();

    const second = await mount();
    await press(second, 'mock-start-over');
    expect(second.getByText('Paper 1 of 4')).toBeTruthy();
    expect((await readMockOverview(getDb(), 'es', ['A1'])).A1?.session).toBeUndefined();
    second.unmount();
  });

  it('változott feladatsor (más ujjlenyomat) esetén a mentés nem folytatható, tiszta intro jön', async () => {
    const first = await mount();
    await press(first, 'mock-begin');
    await solveReading(first);
    first.unmount();

    mockExam = { ...baseExam(), papers: baseExam().papers.map((p) => (p.skill === 'reading' ? { ...p, tasks: [] } : p)) };
    const second = await mount();
    expect(second.queryByTestId('mock-resume')).toBeNull();
    expect(second.getByTestId('mock-begin')).toBeTruthy();
    second.unmount();
  });
});

describe('Próbavizsga: valódi vizsgaóra (E3 a)', () => {
  beforeEach(reset);

  it('lejárt óránál a papír ott zár, ahol tart: a megválaszolatlan 0, és ezt jelzi', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    await solveReading(s);
    await press(s, 'mock-start-paper');
    expect(s.getByText('⏱ 25:00')).toBeTruthy();
    // 25 perc az írás-papír ideje; az órát egyszerre ugorjuk át, a következő tick lezárja a papírt.
    jest.setSystemTime(Date.now() + 25 * 60_000 + 1000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    expect(s.getByText('Paper 3 of 4')).toBeTruthy();
    expect(s.getByText('Time is up. Unanswered questions score 0.')).toBeTruthy();
    s.unmount();
  });
});

describe('Próbavizsga: szójegyzet ismeretlen szóra (E5 c)', () => {
  beforeEach(reset);

  // Egy valódi A1 szó a szint tételeiből; a feladat szövege csak ez a szó.
  const word = () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1');
    const item = items.find((i) => singleWordForm(i, 'es') && i.en && !i.en.includes('/'))!;
    return { items, word: singleWordForm(item, 'es')! };
  };

  const withPassage = (text: string) => {
    const e = baseExam();
    e.papers[0].tasks = [
      { id: 'reading-1', kind: 'read_mc', instruction: 'TAREA 1.', passages: [{ text, options: ['a', 'b', 'c'], correct: 0 }] },
    ];
    mockExam = e;
  };

  it('ismeretlen szónál a feladat alatt koppintásra nyílik a jelentése; a lista szó = jelentés', async () => {
    const { word: w } = word();
    withPassage(w);
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    expect(s.queryByTestId('mock-glossary-entry')).toBeNull(); // zárva, amíg nem koppint
    await press(s, 'mock-glossary-toggle');
    const entries = s.getAllByTestId('mock-glossary-entry');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].props.children.join('')).toContain(`${w} = `);
    s.unmount();
  });

  it('a tanult szóhoz nincs szójegyzet', async () => {
    const { items, word: w } = word();
    withPassage(w);
    for (const it of items) await getDb().upsertPcicCard({ ...sm2NewCard(it.id), state: 'review' as const, interval: 7, reps: 3 });
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    expect(s.queryByTestId('mock-glossary-toggle')).toBeNull();
    s.unmount();
  });
});

describe('Próbavizsga: nem elérhető szint', () => {
  beforeEach(reset);

  afterEach(() => setLanguage('en'));

  it('es→en irányban az A1-hez nincs próbavizsga, gomb visz tovább (a felület spanyolul)', async () => {
    setLanguage('es');
    await getDb().setOnboarding('es', 'en');
    mockLevel = 'A1';
    const s = await mount();
    expect(s.getByText('Todavía no hay examen de práctica para este nivel.')).toBeTruthy();
    await press(s, 'mock-back');
    expect(mockBack).toHaveBeenCalled();
    s.unmount();
  });

  it('es→en irányban az A2 próbavizsga a felület nyelvén (spanyolul) nyílik', async () => {
    setLanguage('es');
    await getDb().setOnboarding('es', 'en');
    mockLevel = 'A2';
    const s = await mount();
    expect(s.getByText('Examen de práctica A2')).toBeTruthy();
    expect(s.getByText('Basado en el formato oficial del examen A2')).toBeTruthy();
    expect(s.getByText('Para aprobar: al menos 30 de 50 puntos en los dos grupos')).toBeTruthy();
    expect(s.getByTestId('mock-begin')).toBeTruthy();
    s.unmount();
  });
});
