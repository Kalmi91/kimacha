// Learning German (es→de, en→de, hu→de) while NOT ONE German lesson is written (the registry is emptied here): the grammar
// tab says so instead of listing the Spanish syllabus or an empty one. With any lesson written the course is listed
// (deCourse.play.test.tsx).

jest.mock('@/lib/games/content', () => {
  const actual = jest.requireActual('@/lib/games/content');
  return {
    ...actual,
    getGrammarTopic: (lang: string, id: string) => (lang === 'de' ? undefined : actual.getGrammarTopic(lang, id)),
    getGrammarTopicIds: (lang: string) => (lang === 'de' ? [] : actual.getGrammarTopicIds(lang)),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { render, screen } from '@testing-library/react-native';

import { setLanguage } from '@/lib/i18n';
import { getDb } from '@/lib/database.web';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

describe.each([
  ['en', 'There is no German grammar course yet. It is on the way.'],
  ['es', 'Todavía no hay un curso de gramática de alemán. Llegará pronto.'],
  ['hu', 'Német nyelvtani kurzus még nincs. Hamarosan jön.'],
] as const)('the grammar tab of a %s native learning German', (source, line) => {
  beforeEach(async () => {
    await getDb().setOnboarding(source, 'de');
    setLanguage(source);
  });
  afterEach(() => setLanguage('en'));

  it('shows the "no German course yet" line, no level, no topic, no Spanish lesson, when no German lesson exists', async () => {
    render(<GrammarSyllabusScreen />);
    await flush(4);

    expect(screen.getByTestId('grammar-no-course')).toBeTruthy();
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.queryAllByTestId(/^grammar-topic-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^grammar-level-/)).toHaveLength(0);
    expect(screen.queryByTestId('grammar-random-start')).toBeNull();
  });
});

describe('the grammar tab keeps listing the courses it has', () => {
  it('es→hu still shows its levels', async () => {
    await getDb().setOnboarding('es', 'hu');
    setLanguage('es');
    render(<GrammarSyllabusScreen />);
    await flush(4);
    expect(screen.queryByTestId('grammar-no-course')).toBeNull();
    expect(screen.getAllByTestId(/^grammar-level-[ABC][12]$/).length).toBe(5);
    setLanguage('en');
  });
});
