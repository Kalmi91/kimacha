// Az Átbeszélő fül végigjátszása: téma-lista → makró (szint + formátum) →
// szókvíz. A sztori és a párbeszéd formátumot a Game fül két képernyője
// rajzolja (app/games/story.tsx, chat.tsx), azoknak saját playthrough-juk van
// (app/games/__tests__/longGames.play.test.tsx), itt csak a rájuk mutató
// útvonalat ellenőrizzük.

jest.mock('react-native-reanimated', () => require('../../../testing/reanimatedMock'));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockPush = jest.fn();
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/talk',
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
  useLocalSearchParams: () => mockParams.current,
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setLanguage } from '@/lib/i18n';
import { buildTalkQuiz } from '@/lib/talk/quiz';
import { flushAsync } from '../../../testing/gameTestUtils';
import TalkScreen from '../../(tabs)/talk';
import TalkMacroScreen from '../[macro]';
import TalkQuizScreen from '../quiz';
import ChatScreen from '../../games/chat';
import StoryScreen from '../../games/story';

describe('Átbeszélő', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    mockParams.current = {};
    // A teszt a magyar feliratokra néz, a jest-futásban nincs eszköz-locale.
    setLanguage('hu');
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  it('lists every macro topic the tree has vocabulary for', async () => {
    render(<TalkScreen />);
    await flushAsync(3);

    expect(screen.getByText('Átbeszélő')).toBeTruthy();
    expect(screen.getByText('Vásárlás és boltok')).toBeTruthy();
    expect(screen.getByText('Étel és étkezés')).toBeTruthy();
    // A kártya felsorolja a makró alá eső fa-témákat: ez az „összes téma".
    expect(screen.getByText(/Ruházat · Vásárlás/)).toBeTruthy();
  });

  it('offers only the levels that have words, and routes each format', async () => {
    mockParams.current = { macro: '12' };
    render(<TalkMacroScreen />);
    await flushAsync(3);

    expect(screen.getByText('Milyen szinten beszéljük át?')).toBeTruthy();
    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();

    // A1-en van megírt pakk: mind a három formátum él.
    expect(screen.queryAllByText('Hamarosan').length).toBe(0);
    fireEvent.press(screen.getByText('Történet'));
    expect(mockPush).toHaveBeenCalledWith('/games/story?talk=talk-12-A1-story');
    fireEvent.press(screen.getByText('Beszélgetés'));
    expect(mockPush).toHaveBeenCalledWith('/games/chat?talk=talk-12-A1-chat');
    fireEvent.press(screen.getByText('Szókvíz'));
    expect(mockPush).toHaveBeenCalledWith('/talk/quiz?macro=12&level=A1');
  });

  it('marks the authored formats "Hamarosan" at a level with no pack, the quiz still runs', async () => {
    mockParams.current = { macro: '12' };
    render(<TalkMacroScreen />);
    await flushAsync(3);

    fireEvent.press(screen.getByText('A2'));
    await flushAsync(1);

    // A2-n nincs pakk: sztori + párbeszéd „Hamarosan", a kvíz megy tovább.
    expect(screen.queryAllByText('Hamarosan').length).toBe(2);
    fireEvent.press(screen.getByText('Szókvíz'));
    expect(mockPush).toHaveBeenCalledWith('/talk/quiz?macro=12&level=A2');
  });

  it('plays a whole quiz round and scores every answer', async () => {
    mockParams.current = { macro: '12', level: 'A1' };
    // Ugyanaz a seed, mint a képernyőn (macro * 1000 + round), így tudjuk,
    // melyik a helyes válasz minden kérdésnél.
    const items = buildTalkQuiz(12, 'A1', 'es', 'hu', 12 * 1000, 10);
    expect(items.length).toBe(10);

    render(<TalkQuizScreen />);
    await flushAsync(3);

    for (let i = 0; i < items.length; i++) {
      expect(screen.getByText(`${i + 1}/10`)).toBeTruthy();
      expect(screen.getByText(items[i].prompt)).toBeTruthy();
      fireEvent.press(screen.getByText(items[i].options[items[i].correctIndex]));
      fireEvent.press(screen.getByText(i === items.length - 1 ? 'Befejezés' : 'Tovább'));
      await flushAsync(1);
    }

    expect(screen.getByText('10 / 10 találat')).toBeTruthy();
  });

  it('opens the pack story straight at the first scene, skipping the game picker', async () => {
    mockParams.current = { talk: 'talk-12-A1-story' };
    render(<StoryScreen />);
    await flushAsync(4);

    // Nincs lista-lépés: rögtön az első jelenet szövege és kérdése látszik.
    expect(screen.getByText('Ana quiere una camisa nueva. Hoy va a la tienda.')).toBeTruthy();
    expect(screen.getByText('una camisa nueva')).toBeTruthy();
  });

  it('starts the pack conversation at its setup question', async () => {
    mockParams.current = { talk: 'talk-12-A1-chat' };
    render(<ChatScreen />);
    await flushAsync(4);

    expect(screen.getByText('Una camisa.')).toBeTruthy();
    expect(screen.getByText('Unos zapatos.')).toBeTruthy();
  });
});
