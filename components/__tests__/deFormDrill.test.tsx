// The form drill of the German course grades the umlaut and the ß as the thing being drilled (Vater / Väter,
// schon / schön): dropping the dots is wrong whatever the accent switch says; the typewriter digraphs (Vaeter,
// Strasse) count only while accents are forgiven; case and closing punctuation are forgiven. Twin of huFormDrill.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { getDb } from '@/lib/database.web';
import { speechLang } from '@/lib/languages';
import { speak } from '@/lib/speech';
import { makeFlush } from '@/test-utils/flush';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

const flush = makeFlush(3);

const topic = (answer: string, accept?: string[]): LessonV2 => ({
  schema: 2,
  topic: 'de-form',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [],
  speak: { en: 'e', es: 's' },
  items: [{ id: 'form-de', kind: 'form', verb: 'Plural', person: 'Vater', answer, accept, table: 'x' }],
});

async function answerWith(typed: string, lesson: LessonV2) {
  const onFinish = jest.fn();
  const view = render(<GrammarDrill topic={lesson} learnedLang="de" contentLang="en" onFinish={onFinish} kinds={['form']} />);
  await flush();
  fireEvent.changeText(screen.getByTestId('formInput'), typed);
  fireEvent.press(screen.getByTestId('formCheck'));
  fireEvent.press(screen.getByTestId('grammar-next'));
  view.unmount();
  return onFinish;
}

describe('German form drill: umlauts and ß', () => {
  beforeEach(async () => {
    await getDb().setStrictAccents(false);
    (speak as jest.Mock).mockClear();
  });
  afterAll(async () => {
    await getDb().setStrictAccents(false);
  });

  it('a missing umlaut is wrong (Vater for Väter, schon for schön)', async () => {
    expect(await answerWith('die Vater', topic('die Väter', ['Väter']))).toHaveBeenCalledWith(0, 1);
    expect(await answerWith('schon', topic('schön'))).toHaveBeenCalledWith(0, 1);
  });

  it('the exact form is right, and case and closing punctuation are forgiven', async () => {
    expect(await answerWith('die Väter', topic('die Väter'))).toHaveBeenCalledWith(1, 1);
    expect(await answerWith('Die väter.', topic('die Väter'))).toHaveBeenCalledWith(1, 1);
  });

  it('an accepted variant (the noun without the article) is right, and the umlaut rule holds for it too', async () => {
    expect(await answerWith('Väter', topic('die Väter', ['Väter']))).toHaveBeenCalledWith(1, 1);
    expect(await answerWith('Vater', topic('die Väter', ['Väter']))).toHaveBeenCalledWith(0, 1);
  });

  it('der / die / das are never swapped', async () => {
    expect(await answerWith('der Väter', topic('die Väter'))).toHaveBeenCalledWith(0, 1);
  });

  it('the digraph spelling counts while accents are forgiven, and not with strict accents on', async () => {
    expect(await answerWith('die Vaeter', topic('die Väter'))).toHaveBeenCalledWith(1, 1);
    expect(await answerWith('die Strasse', topic('die Straße'))).toHaveBeenCalledWith(1, 1);

    await getDb().setStrictAccents(true);
    expect(await answerWith('die Vaeter', topic('die Väter'))).toHaveBeenCalledWith(0, 1);
    expect(await answerWith('die Strasse', topic('die Straße'))).toHaveBeenCalledWith(0, 1);
    expect(await answerWith('die Straße', topic('die Straße'))).toHaveBeenCalledWith(1, 1);
  });

  it('the correct form is spoken with the German voice after Check', async () => {
    await answerWith('xxx', topic('die Väter'));
    expect(speak).toHaveBeenCalledWith('die Väter', speechLang('de'));
    expect(speechLang('de')).toBe('de-DE');
  });
});
