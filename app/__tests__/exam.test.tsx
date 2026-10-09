// a szintvizsga képernyője.
// A tétel-építő mockolt (a tételek tartalmát a lib/exam/__tests__/builder.test.ts fedi), itt a
// folyamat: zárva nem indul; kérdés közben helyes válasz után nincs visszajelzés, hibás után
// a helyes látszik; átmenéskor a gomb a következő szintre (nincs automatikus váltás); bukáskor
// pontszám + újrapróba; az eredmény mentődik. Mock-minta: app/__tests__/onboarding.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockLevel = 'A1';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: mockLevel }),
  useRouter: () => ({ back: mockBack, push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() }),
}));

// Egy tétel minden fajtából: 5 / 6 jó = 83% (átment), 4 / 6 = 66% (bukik).
const mockExam = [
  { kind: 'word_type', skill: 'words', itemId: 'o1', prompt: 'the window', answer: 'la ventana' },
  {
    kind: 'match',
    skill: 'words',
    itemIds: ['o2', 'o3', 'o4', 'o5'],
    pairs: [
      { left: 'la casa', right: 'the house' },
      { left: 'el libro', right: 'the book' },
      { left: 'la mesa', right: 'the table' },
      { left: 'el agua', right: 'the water' },
    ],
  },
  { kind: 'sent_order', skill: 'words', itemId: 'o6', prompt: 'I eat at home.', answerTokens: ['yo', 'como', 'en', 'casa'], sentence: 'Yo como en casa.', distractors: ['tú', 'comes'] },
  { kind: 'sent_type', skill: 'words', itemId: 'o7', prompt: 'We live here.', answer: 'Vivimos aquí.' },
  { kind: 'gap_mc', skill: 'grammar', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 },
  {
    kind: 'reading_mc',
    skill: 'reading',
    itemIds: ['o8', 'o9'],
    text: 'Tengo un perro. Es grande.',
    options: ['I have a dog. It is big.', 'I have a cat. It is big.', 'I have a dog. It is small.'],
    correctIndex: 0,
  },
];
const mockBuildExam = jest.fn(() => mockExam);
jest.mock('@/lib/exam/builder', () => ({ buildExam: (...args: unknown[]) => mockBuildExam(...(args as [])) }));

import { act, fireEvent, render } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, syllabusTopic } from '@/lib/grammar/syllabus';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { seedA1ExamState, seedExamState } from '@/lib/exam/devSeed';
import { localDateString } from '@/lib/usageStats';
import ExamScreen from '../exam';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

type Screen = ReturnType<typeof render>;

const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

const typeAndCheck = async (screen: Screen, text: string) => {
  fireEvent.changeText(screen.getByTestId('exam-input'), text);
  await press(screen, 'exam-check');
};

// A fajta helyes (ok) vagy hibás megoldása, a mockExam sorrendjében.
const solve = {
  word: async (s: Screen, ok: boolean) => typeAndCheck(s, ok ? 'la ventana' : 'el coche'),
  match: async (s: Screen, ok: boolean) => {
    for (const i of ok ? [0, 1, 2, 3] : [1, 0, 2, 3]) await press(s, `exam-right-${i}`);
    await press(s, 'exam-check');
  },
  tiles: async (s: Screen, ok: boolean) => {
    for (const w of ok ? ['yo', 'como', 'en', 'casa'] : ['casa', 'en', 'como', 'yo']) {
      fireEvent.press(s.getByText(w));
      await flush(2);
    }
    await press(s, 'exam-check');
  },
  sentence: async (s: Screen, ok: boolean) => typeAndCheck(s, ok ? 'Vivimos aquí.' : 'Vivo allí.'),
  choice: async (s: Screen, ok: boolean) => press(s, ok ? 'exam-option-0' : 'exam-option-1'),
};
const steps = [solve.word, solve.match, solve.tiles, solve.sentence, solve.choice, solve.choice] as const;

// Végigmegy a 6 tételen: `wrong` = a hibásan megoldott tételek sorszáma (0-tól).
const runExam = async (screen: Screen, wrong: number[] = []) => {
  for (let i = 0; i < steps.length; i++) {
    expect(screen.getByTestId('exam-counter').props.children).toBe(`Question ${i + 1} / 6`);
    const ok = !wrong.includes(i);
    await steps[i](screen, ok);
    if (!ok) {
      // Hibás válasz után látszik a helyes, és csak a Next lép tovább.
      expect(screen.getByText('Not quite!')).toBeTruthy();
      await press(screen, 'exam-next');
    } else if (i < steps.length - 1) {
      // A1/A5 c: helyes válasz után nincs visszajelzés, a vizsga megy tovább.
      expect(screen.queryByText('Not quite!')).toBeNull();
      expect(screen.queryByTestId('exam-next')).toBeNull();
    }
  }
};

const seed = async () => {
  await getDb().setOnboarding('en', 'es');
  await seedA1ExamState(getDb(), 'es', '2026-10-01');
};

describe('szintvizsga képernyő (A1)', () => {
  beforeEach(async () => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockBuildExam.mockClear();
    mockLevel = 'A1';
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
  });

  it('zárva nem indul vizsga: lakat-lap és vissza gomb, tételek építése nélkül', async () => {
    const screen = render(<ExamScreen />);
    await flush();
    expect(screen.getByText('Level exam locked')).toBeTruthy();
    expect(mockBuildExam).not.toHaveBeenCalled();
    await press(screen, 'exam-back');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('nyitva: a bevezető kimondja a szabályt (nincs élet, 80%), és a felületen nincs DELE', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    expect(screen.getByText('A1 level exam')).toBeTruthy();
    expect(screen.getByText('Words: 4 questions')).toBeTruthy();
    expect(screen.getByText('Grammar: 1 question')).toBeTruthy();
    expect(screen.getByText('Reading: 1 question')).toBeTruthy();
    expect(screen.getByText('No lives. If you miss one, the right answer is shown.')).toBeTruthy();
    expect(screen.getByText('Pass: 80% overall')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/DELE/i);
    await press(screen, 'exam-not-now');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('minden tétel helyes: nincs visszajelzés kérdés közben, átment, a gomb a következő szintre visz és az eredmény mentődik', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen);

    expect(screen.getByTestId('exam-score').props.children).toBe('6 / 6 · 100%');
    expect(screen.getByText('A1 passed')).toBeTruthy();
    expect(await getDb().getExamResults()).toMatchObject({ A1: { passed: true, best: 100 } });

    // Nincs automatikus váltás; a gomb vált.
    expect(await getDb().getPcicLevel()).toBe('A1');
    await press(screen, 'exam-continue');
    expect(await getDb().getPcicLevel()).toBe('A2');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('80% (5 / 6) még átmegy; a hibás tétel helyes megoldása látszik, a Next lép tovább', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen, [4]);
    expect(screen.getByTestId('exam-score').props.children).toBe('5 / 6 · 83%');
    expect(screen.getByText('A1 passed')).toBeTruthy();
  });

  it('hibás szó-válasznál a helyes megoldás és a "Next" látszik, a számláló csak a Next után lép', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await typeAndCheck(screen, 'el coche');
    expect(screen.getByTestId('exam-correct-answer').props.children).toBe('la ventana');
    expect(screen.getByTestId('exam-counter').props.children).toBe('Question 1 / 6');
    await press(screen, 'exam-next');
    expect(screen.getByTestId('exam-counter').props.children).toBe('Question 2 / 6');
  });

  it('hibás mondat-összerakásnál a helyes mondat az eredeti alakjában látszik (nagybetű, írásjel)', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await solve.word(screen, true);
    await solve.match(screen, true);
    await solve.tiles(screen, false);
    expect(screen.getByTestId('exam-correct-answer').props.children).toBe('Yo como en casa.');
  });

  it('a "nem tudom" hibásnak számít és mutatja a helyeset', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await press(screen, 'exam-dont-know');
    expect(screen.getByTestId('exam-correct-answer').props.children).toBe('la ventana');
  });

  it('bukás: pontszám + küszöb, nincs "következő szint" gomb, az újrapróba új vizsgát épít, az eredmény mentődik', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen, [0, 4, 5]);

    expect(screen.getByTestId('exam-score').props.children).toBe('3 / 6 · 50%');
    expect(screen.getByText('Not yet')).toBeTruthy();
    expect(screen.getByText('You need 80% to pass.')).toBeTruthy();
    expect(screen.queryByTestId('exam-continue')).toBeNull();
    expect(await getDb().getExamResults()).toMatchObject({ A1: { passed: false, best: 50 } });

    mockBuildExam.mockClear();
    await press(screen, 'exam-retry');
    expect(mockBuildExam).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('exam-counter').props.children).toBe('Question 1 / 6');
  });

  it('az újrapróbán elért átmenés után a gyengébb próba nem veszi el az átmenést és a legjobb pontszámot', async () => {
    await seed();
    await getDb().saveExamResult('A1', 100, true, '2026-09-30');
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen, [0, 4, 5]);
    expect((await getDb().getExamResults()).A1).toMatchObject({ passed: true, best: 100, last: 50 });
  });

  it('kilépés: megerősítés kell, a félkész vizsga nem mentődik', async () => {
    await seed();
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await typeAndCheck(screen, 'la ventana');
    await press(screen, 'exam-close');
    expect(screen.getByText('Leave the exam')).toBeTruthy();

    await press(screen, 'exam-keep-going');
    expect(screen.getByTestId('exam-counter').props.children).toBe('Question 2 / 6');

    await press(screen, 'exam-close');
    await press(screen, 'exam-leave');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(await getDb().getExamResults()).toEqual({});
  });
});

describe.each([
  ['A2', 'B1'],
  ['B1', 'B2'],
  ['B2', undefined],
] as const)('szintvizsga képernyő (%s)', (level, next) => {
  beforeEach(async () => {
    mockBack.mockClear();
    mockBuildExam.mockClear();
    mockLevel = level;
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel(level);
  });
  afterAll(() => {
    mockLevel = 'A1';
  });

  it('zárva, amíg a szint szavai és egy lecke nincs meg (az A1 készen sem nyitja)', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const screen = render(<ExamScreen />);
    await flush();
    expect(screen.getByText('Level exam locked')).toBeTruthy();
    expect(mockBuildExam).not.toHaveBeenCalled();
  });

  it('feloldva a bevezető a szint nevét mutatja; minden tétel helyes: átment, mentődik, ajánlja a következő szintet (B2 után nincs)', async () => {
    await seedExamState(getDb(), 'es', '2026-10-01');
    const screen = render(<ExamScreen />);
    await flush();
    expect(screen.getByText(`${level} level exam`)).toBeTruthy();
    await press(screen, 'exam-start');
    await runExam(screen);

    expect(screen.getByText(`${level} passed`)).toBeTruthy();
    expect(await getDb().getExamResults()).toMatchObject({ [level]: { passed: true, best: 100 } });
    if (next) {
      await press(screen, 'exam-continue');
      expect(await getDb().getPcicLevel()).toBe(next);
    } else {
      expect(screen.queryByTestId('exam-continue')).toBeNull();
    }
  });

  it('80% alatt nem megy át, nincs következő-szint gomb', async () => {
    await seedExamState(getDb(), 'es', '2026-10-01');
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen, [0, 4, 5]);
    expect(screen.getByText('Not yet')).toBeTruthy();
    expect(screen.queryByTestId('exam-continue')).toBeNull();
    expect(await getDb().getExamResults()).toMatchObject({ [level]: { passed: false, best: 50 } });
  });
});

describe('szintvizsga: elrontott szó vissza az SM-2-be (2b, A8 a)', () => {
  const realExam = (wordId: string) => [
    { kind: 'word_type', skill: 'words', itemId: wordId, prompt: 'the window', answer: 'la ventana' },
    { kind: 'gap_mc', skill: 'grammar', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 },
  ];

  beforeEach(async () => {
    mockBack.mockClear();
    mockBuildExam.mockClear();
    mockLevel = 'A1';
    setPcicTarget('es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
    await seed();
  });

  it('a hibás szó kártyája `again`-t kap és ma esedékes; a nyelvtani hiba után a többi kártya érintetlen', async () => {
    const [wordId, otherId] = pcicItemsForLevel('A1').map((i) => i.id);
    const before = await getDb().getPcicCards();
    expect(before.find((c) => c.itemId === wordId)).toMatchObject({ state: 'review', lapses: 0 });

    mockBuildExam.mockReturnValueOnce(realExam(wordId) as never);
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await solve.word(screen, false);
    await press(screen, 'exam-next');
    await solve.choice(screen, false);
    await press(screen, 'exam-next');

    expect(screen.getByTestId('exam-score').props.children).toBe('0 / 2 · 0%');
    const after = await getDb().getPcicCards();
    expect(after).toHaveLength(before.length);
    expect(after.find((c) => c.itemId === wordId)).toMatchObject({ state: 'learning', due: localDateString(), lapses: 1, lastReview: localDateString() });
    // Minden más kártya (a nyelvtani hiba nem kap SM-2 változást) változatlan.
    expect(after.filter((c) => c.itemId !== wordId)).toEqual(before.filter((c) => c.itemId !== wordId));
    expect(after.find((c) => c.itemId === otherId)).toEqual(before.find((c) => c.itemId === otherId));
  });

  it('a helyes szó és a csak nyelvtani hiba nem változtat egy kártyát sem', async () => {
    const [wordId] = pcicItemsForLevel('A1').map((i) => i.id);
    const before = await getDb().getPcicCards();
    mockBuildExam.mockReturnValueOnce(realExam(wordId) as never);
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await solve.word(screen, true);
    await solve.choice(screen, false);
    await press(screen, 'exam-next');
    expect(await getDb().getPcicCards()).toEqual(before);
  });
});

describe('szintvizsga: eredmény készségenként, gyenge pontnál link (2c)', () => {
  beforeEach(async () => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockBuildExam.mockClear();
    mockLevel = 'A1';
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
    await seed();
  });

  const finish = async (wrong: number[]) => {
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await runExam(screen, wrong);
    return screen;
  };

  it('szó, nyelvtan, olvasás: pont, % és Strong / Weak; a gyenge nyelvtanhoz a lecke linkje, ami a leckére visz', async () => {
    const screen = await finish([4]);
    expect(screen.getByTestId('exam-skill-words-score').props.children).toBe('4 / 4 · 100%');
    expect(screen.getByTestId('exam-skill-words-verdict').props.children).toBe('Strong');
    expect(screen.getByTestId('exam-skill-grammar-score').props.children).toBe('0 / 1 · 0%');
    expect(screen.getByTestId('exam-skill-grammar-verdict').props.children).toBe('Weak');
    expect(screen.getByTestId('exam-skill-reading-score').props.children).toBe('1 / 1 · 100%');
    expect(screen.getByTestId('exam-skill-reading-verdict').props.children).toBe('Strong');

    const title = syllabusTopic('presente-regular', 'es')?.title.en as string;
    const link = screen.getByTestId('exam-lesson-presente-regular');
    expect(screen.getByText(`Review lesson: ${title}`)).toBeTruthy();
    expect(screen.queryByTestId('exam-review-words')).toBeNull();
    fireEvent.press(link);
    expect(mockPush).toHaveBeenCalledWith('/grammar/presente-regular');
  });

  it('gyenge szó: a "Review these words" a tanulófülre (a vizsga szintjére) visz, lecke-link nélkül', async () => {
    await getDb().setPcicLevel('A2');
    const screen = await finish([0, 1]);
    expect(screen.getByTestId('exam-skill-words-score').props.children).toBe('2 / 4 · 50%');
    expect(screen.getByTestId('exam-skill-words-verdict').props.children).toBe('Weak');
    expect(screen.queryByTestId('exam-lesson-presente-regular')).toBeNull();

    await press(screen, 'exam-review-words');
    expect(await getDb().getPcicLevel()).toBe('A1');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('gyenge olvasás (szó erős): "Practice sentences" a tanulófülre', async () => {
    const screen = await finish([5]);
    expect(screen.getByTestId('exam-skill-reading-verdict').props.children).toBe('Weak');
    expect(screen.queryByTestId('exam-review-words')).toBeNull();
    await press(screen, 'exam-practice-sentences');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('minden készség erős: nincs gyenge-pont gomb', async () => {
    const screen = await finish([]);
    expect(screen.queryByTestId('exam-review-words')).toBeNull();
    expect(screen.queryByTestId('exam-practice-sentences')).toBeNull();
    expect(screen.queryByTestId('exam-lesson-presente-regular')).toBeNull();
    expect(screen.getByTestId('exam-skill-grammar-verdict').props.children).toBe('Strong');
  });
});

describe('szintvizsga: szóbeli tétel a billentyűzet mikrofonjával (13. lépés)', () => {
  const speak = { kind: 'speak', skill: 'speaking', itemId: 'o1', prompt: 'I eat at home.', expected: 'Yo como en casa.', mode: 'translate' };
  const gap = { kind: 'gap_mc', skill: 'grammar', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 };

  beforeEach(async () => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockBuildExam.mockClear();
    mockLevel = 'A1';
    setPcicTarget('es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
    await seed();
  });

  const dictate = async (screen: Screen, text: string) => {
    fireEvent.changeText(screen.getByTestId('exam-speak-input'), text);
    await press(screen, 'exam-check');
  };

  it('a bevezető külön sorban mondja a szóbeli tételek számát, a tétel szövegmező a billentyűzet mikrofonjához', async () => {
    mockBuildExam.mockReturnValueOnce([speak, gap] as never);
    const screen = render(<ExamScreen />);
    await flush();
    expect(screen.getByText('Speaking: 1 question')).toBeTruthy();
    await press(screen, 'exam-start');
    expect(screen.getByTestId('exam-speak-mode').props.children).toBe('Say it in Spanish');
    expect(screen.getByTestId('exam-speak-prompt').props.children).toBe('I eat at home.');
    expect(screen.getByTestId('exam-speak-input')).toBeTruthy();
  });

  it('helyes diktálás után nincs visszajelzés, az eredményen a szóbeli készség külön sorban látszik', async () => {
    mockBuildExam.mockReturnValueOnce([speak, gap] as never);
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await dictate(screen, 'yo como en casa');
    expect(screen.getByTestId('exam-counter').props.children).toBe('Question 2 / 2');
    expect(screen.queryByText('Not quite!')).toBeNull();
    await solve.choice(screen, true);

    expect(screen.getByTestId('exam-score').props.children).toBe('2 / 2 · 100%');
    expect(screen.getByTestId('exam-skill-speaking-score').props.children).toBe('1 / 1 · 100%');
    expect(screen.getByTestId('exam-skill-speaking-verdict').props.children).toBe('Strong');
    expect(screen.getByText('Speaking')).toBeTruthy();
  });

  it('hibás diktálás: az eltérő szavak ki vannak emelve, a szóbeli gyenge, és nincs SM-2 változás', async () => {
    const before = await getDb().getPcicCards();
    mockBuildExam.mockReturnValueOnce([speak, gap] as never);
    const screen = render(<ExamScreen />);
    await flush();
    await press(screen, 'exam-start');
    await dictate(screen, 'yo bebo en casa');
    expect(screen.getAllByTestId('exam-speak-missing').map((n) => n.props.children.join(''))).toEqual([' como']);
    expect(screen.getAllByTestId('exam-speak-extra').map((n) => n.props.children.join(''))).toEqual([' bebo']);
    await press(screen, 'exam-next');
    await solve.choice(screen, true);

    expect(screen.getByTestId('exam-skill-speaking-score').props.children).toBe('0 / 1 · 0%');
    expect(screen.getByTestId('exam-skill-speaking-verdict').props.children).toBe('Weak');
    expect(await getDb().getPcicCards()).toEqual(before);
  });

  it('az ékezet a mentett "Accents count" beállítást követi', async () => {
    const accent = { ...speak, prompt: 'She is here.', expected: 'Ella está aquí.' };
    await getDb().setStrictAccents(true);
    mockBuildExam.mockReturnValueOnce([accent, gap] as never);
    const strict = render(<ExamScreen />);
    await flush();
    await press(strict, 'exam-start');
    await dictate(strict, 'ella esta aqui');
    expect(strict.getAllByTestId('exam-speak-missing')).toHaveLength(2);
    strict.unmount();

    await getDb().setStrictAccents(false);
    mockBuildExam.mockReturnValueOnce([accent, gap] as never);
    const loose = render(<ExamScreen />);
    await flush();
    await press(loose, 'exam-start');
    await dictate(loose, 'ella esta aqui');
    expect(loose.getByTestId('exam-counter').props.children).toBe('Question 2 / 2');
  });
});
