// The flow of the mock exam screen.
// The task-set builder is mocked (its content is covered by lib/exam/mock/__tests__/build.test.ts), here it is
// the flow: intro, a clock and tasks per paper (no immediate feedback), listening played
// twice, the oral placeholder (group 2 = listening x2, provisional), saving the result,
// resuming an abandoned exam (saved per paper), an expiring clock, glossary for an unknown word.
// Mock pattern: app/__tests__/exam.test.tsx.

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
  official: true,
  skillNames: {
    reading: 'Comprensión de lectura',
    writing: 'Expresión e interacción escritas',
    listening: 'Comprensión auditiva',
    speaking: 'Expresión e interacción orales',
  },
  rule: {
    kind: 'groups',
    groups: [
      { skills: ['reading', 'writing'], needed: 30, of: 50 },
      { skills: ['listening', 'speaking'], needed: 30, of: 50 },
    ],
  },
  papers: [
    {
      id: 'reading',
      name: 'Comprensión de lectura',
      minutes: 45,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'reading-1',
          skill: 'reading',
          kind: 'read_mc',
          instruction: 'TAREA 1. Lea los textos y marque la opción correcta.',
          passages: [{ text: 'Tengo un perro. Es grande.', options: ['I have a dog. It is big.', 'I have a cat. It is big.', 'I have a dog. It is small.'], correct: 0 }],
        },
      ],
    },
    {
      id: 'writing',
      name: 'Expresión e interacción escritas',
      minutes: 25,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'writing-1',
          skill: 'writing',
          kind: 'short_message',
          instruction: 'TAREA 1. Escriba un texto.',
          prompt: 'Escriba un mensaje a un amigo.',
          minWords: 3,
          points: [{ id: 'name', label: 'Dice su nombre', keywords: ['me llamo'] }],
        },
      ],
    },
    {
      id: 'listening',
      name: 'Comprensión auditiva',
      minutes: 25,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'listening-1',
          skill: 'listening',
          kind: 'listen_mc',
          instruction: 'TAREA 1. Va a escuchar unas frases.',
          audio: ['Tengo un perro.'],
          questions: [{ options: ['I have a dog.', 'I have a cat.', 'I have a car.'], correct: 0 }],
        },
      ],
    },
    { id: 'speaking', name: 'Expresión e interacción orales', minutes: 10, points: 25, placeholder: true, tasks: [] },
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

// The clock's per-second ticks should not run during tests (act warning); expiry is a separate test.
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

// The correct solutions of the three papers to fill in (reading, writing, listening), with the oral placeholder.
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
    await press(s, 'mock-option-r0-1'); // wrong answer
    expect(s.queryByText(t().games.correctFeedback)).toBeNull(); // no immediate feedback
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
    await press(s, 'mock-option-r0-1'); // wrong
    await press(s, 'mock-next-task');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-next-task'); // empty writing
    await press(s, 'mock-start-paper');
    await press(s, 'mock-next-task'); // empty listening
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
    // The mocked audio is "done" immediately, so the lock releases by itself: the 2nd play can go.
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
    await solveReading(first); // reading done, correct
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
    await press(second, 'mock-next-task'); // empty writing
    await solveListening(second);
    await press(second, 'mock-start-paper');
    await press(second, 'mock-speaking-continue');
    // Reading gives 25 points from the saved (correct) answers, writing is empty = 0: group 1 is 25 / 50, fail.
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

    mockExam = { ...baseExam(), papers: baseExam().papers.map((p) => (p.id === 'reading' ? { ...p, tasks: [] } : p)) };
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
    // 25 minutes is the writing paper's time; we skip the clock in one jump, the next tick closes the paper.
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

  // A real A1 word from the level's items; the task text is just this word.
  const word = () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1');
    const item = items.find((i) => singleWordForm(i, 'es') && i.en && !i.en.includes('/'))!;
    return { items, word: singleWordForm(item, 'es')! };
  };

  const withPassage = (text: string) => {
    const e = baseExam();
    e.papers[0].tasks = [
      { id: 'reading-1', skill: 'reading', kind: 'read_mc', instruction: 'TAREA 1.', passages: [{ text, options: ['a', 'b', 'c'], correct: 0 }] },
    ];
    mockExam = e;
  };

  it('ismeretlen szónál a feladat alatt koppintásra nyílik a jelentése; a lista szó = jelentés', async () => {
    const { word: w } = word();
    withPassage(w);
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    expect(s.queryByTestId('mock-glossary-entry')).toBeNull(); // closed until the user taps
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

// Fixtures of the English direction (es→en): A1 is one written paper + oral placeholder, A2 is a shared reading + writing paper,
// listening, oral placeholder; the UI is in Spanish, the exam text is English.
const EN_NAMES = { reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking' } as const;
const enTasks = (): MockExam['papers'][number]['tasks'] => [
  { id: 'x-1', skill: 'reading', kind: 'read_mc', instruction: 'PART 1. Read the texts.', passages: [{ text: 'I have a dog. It is big.', options: ['Tengo un perro. Es grande.', 'Tengo un gato. Es grande.', 'Tengo un perro. Es pequeño.'], correct: 0 }] },
  { id: 'x-2', skill: 'writing', kind: 'short_message', instruction: 'PART 2. Write.', prompt: 'Write to a friend.', minWords: 3, points: [{ id: 'name', label: 'Says their name', keywords: ['my name is'] }] },
  { id: 'x-3', skill: 'listening', kind: 'listen_mc', instruction: 'PART 3. You will hear.', audio: ['I have a dog.'], plays: 1, questions: [{ options: ['Tengo un perro.', 'Tengo un gato.', 'Tengo un coche.'], correct: 0 }] },
];
const enExam = (level: 'A1' | 'A2'): MockExam => {
  const [read, write, listen] = enTasks();
  const base = { target: 'en' as const, level, seed: 1, official: false, skillNames: EN_NAMES };
  if (level === 'A1') {
    return {
      ...base,
      rule: { kind: 'total', needed: 50, of: 100 },
      papers: [
        { id: 'written', name: 'Written test', minutes: 75, points: 75, placeholder: false, tasks: [listen, read, write] },
        { id: 'speaking', name: 'Speaking', minutes: 3.5, points: 25, placeholder: true, tasks: [] },
      ],
    };
  }
  return {
    ...base,
    rule: { kind: 'average', passPct: 50, approximate: true },
    papers: [
      { id: 'readingwriting', name: 'Reading and Writing', minutes: 60, points: 50, placeholder: false, tasks: [read, write] },
      { id: 'listening', name: 'Listening', minutes: 30, points: 25, placeholder: false, tasks: [listen] },
      { id: 'speaking', name: 'Speaking', minutes: 9, points: 25, placeholder: true, tasks: [] },
    ],
  };
};

const GOOD_EN_MESSAGE = 'Hello my name is Ana and I live in a small house near the park';

describe('Próbavizsga: es→en irány (nemzetközi minta, a felület spanyolul)', () => {
  beforeEach(async () => {
    await reset();
    setLanguage('es');
    await getDb().setOnboarding('es', 'en');
  });
  afterEach(() => setLanguage('en'));

  it('nem elérhető szinten (B1) nincs próbavizsga, gomb visz tovább', async () => {
    mockLevel = 'B1';
    const s = await mount();
    expect(s.getByText('Todavía no hay examen de práctica para este nivel.')).toBeTruthy();
    await press(s, 'mock-back');
    expect(mockBack).toHaveBeenCalled();
    s.unmount();
  });

  it('A1: nemzetközi-minta felirat (nem "hivatalos"), egy 75 perces írásbeli, összpont-szabály, szóbeli helyőrző, összpont-sor az eredményen', async () => {
    mockLevel = 'A1';
    mockExam = enExam('A1');
    const s = await mount();
    expect(s.getByText('Examen de práctica A1')).toBeTruthy();
    expect(s.getByText('Examen de práctica basado en un formato internacional A1')).toBeTruthy();
    expect(s.queryByText(/oficial/i)).toBeNull();
    expect(s.getByText('Written test: 75 min, 3 tareas, 75 puntos')).toBeTruthy();
    expect(s.getByText('Speaking: 3.5 min, parte con micrófono próximamente')).toBeTruthy();
    expect(s.getByText('Para aprobar: al menos 50 de 100 puntos en total. Una destreza puede compensar a otra.')).toBeTruthy();

    await press(s, 'mock-begin');
    expect(s.getByText('Prueba 1 de 2')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText('⏱ 75:00')).toBeTruthy();
    // The listening task (1st on the paper) can be played once: the UI shows this.
    expect(s.getByText('Reproducciones restantes: 1')).toBeTruthy();
    await press(s, 'mock-option-l0-0');
    await press(s, 'mock-next-task');
    await press(s, 'mock-option-r0-0');
    await press(s, 'mock-next-task');
    fireEvent.changeText(s.getByTestId('mock-message'), GOOD_EN_MESSAGE);
    await press(s, 'mock-next-task');

    expect(s.getByText('Prueba 2 de 2')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText('Expresión oral: la parte con micrófono llega pronto')).toBeTruthy();
    expect(s.getByText('Esta parte aún no cuenta en tu puntuación. Tu resultado es provisional y usa tus otras tres destrezas.')).toBeTruthy();
    await press(s, 'mock-speaking-continue');

    expect(s.getByText('Aprobado')).toBeTruthy();
    expect(s.getByText('Total: 100 / 100, mínimo 50, aprobado (provisional)')).toBeTruthy();
    expect(s.getByText('Provisional: la parte oral aún no está incluida, así que el total se calcula proporcionalmente con las otras tres destrezas.')).toBeTruthy();
    expect(s.getByText('Speaking: no incluida')).toBeTruthy();
    expect(s.getByText('Listening: 25 / 25')).toBeTruthy();
    expect(s.queryByTestId('mock-group-1')).toBeNull();
    const last = (await readMockOverview(getDb(), 'en', ['A1'])).A1?.last;
    expect(last).toMatchObject({ passed: true, provisional: true, groups: [{ points: 100, needed: 50, of: 100 }] });
    s.unmount();
  });

  it('A1 hallás-újrajátszás: az első rész egyszer játszható, a második koppintás néma', async () => {
    mockLevel = 'A1';
    mockExam = enExam('A1');
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-play');
    expect(s.getByText('Reproducciones restantes: 0')).toBeTruthy();
    (speak as jest.Mock).mock.calls[0][2].onDone?.();
    await press(s, 'mock-play');
    expect(speak).toHaveBeenCalledTimes(1);
    s.unmount();
  });

  it('A1: egy készség nullával is átmehet (nincs részenkénti minimum), ha az összpont megvan', async () => {
    mockLevel = 'A1';
    mockExam = enExam('A1');
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-next-task'); // empty listening
    await press(s, 'mock-option-r0-0');
    await press(s, 'mock-next-task');
    fireEvent.changeText(s.getByTestId('mock-message'), GOOD_EN_MESSAGE);
    await press(s, 'mock-next-task');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-speaking-continue');
    expect(s.getByText('Listening: 0 / 25')).toBeTruthy();
    expect(s.getByText('Total: 67 / 100, mínimo 50, aprobado (provisional)')).toBeTruthy();
    s.unmount();
  });

  it('A2: Olvasás + Írás közös papír (60 perc), Hallás, átlag-szabály "közelítő" jelzéssel, átlag-sor az eredményen', async () => {
    mockLevel = 'A2';
    mockExam = enExam('A2');
    const s = await mount();
    expect(s.getByText('Examen de práctica basado en un formato internacional A2')).toBeTruthy();
    expect(s.getByText('Reading and Writing: 60 min, 2 tareas, 50 puntos')).toBeTruthy();
    expect(s.getByText('Listening: 30 min, 1 tarea, 25 puntos')).toBeTruthy();
    expect(s.getByText(/promedio de alrededor del 50%.*estimación/)).toBeTruthy();

    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    expect(s.getByText('⏱ 60:00')).toBeTruthy();
    await press(s, 'mock-option-r0-0');
    await press(s, 'mock-next-task');
    fireEvent.changeText(s.getByTestId('mock-message'), GOOD_EN_MESSAGE);
    await press(s, 'mock-next-task');
    expect(s.getByText('Prueba 2 de 3')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText('⏱ 30:00')).toBeTruthy();
    await press(s, 'mock-option-l0-0');
    await press(s, 'mock-next-task');
    await press(s, 'mock-start-paper');
    await press(s, 'mock-speaking-continue');

    expect(s.getByText('Aprobado')).toBeTruthy();
    expect(s.getByText('Promedio de las destrezas: 100%, mínimo aproximado 50% (estimación), aprobado (provisional)')).toBeTruthy();
    expect(s.getByText('Provisional: la parte oral aún no está incluida, así que el promedio usa las otras tres destrezas.')).toBeTruthy();
    s.unmount();
  });

  it('a felület angolul sem ír "official" vizsgát az angol irányon (nemzetközi minta felirat)', async () => {
    setLanguage('en');
    mockLevel = 'A1';
    mockExam = enExam('A1');
    const s = await mount();
    expect(s.getByText('Practice exam modelled on an international A1 format')).toBeTruthy();
    expect(s.queryByText(/official/i)).toBeNull();
    expect(s.getByText('To pass: at least 50 of 100 points in total. One skill can make up for another.')).toBeTruthy();
    s.unmount();
  });
});
