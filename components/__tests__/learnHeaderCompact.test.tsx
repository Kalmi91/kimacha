// The compact Learn header's parts: the `compact` 💬 button (level-chip sized, every other caller unchanged),
// BadgeRow `singleLine`, and the continuous progress bar (ProgressBar `continuous`).

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import FeedbackButton from '../FeedbackModal';
import BadgeRow from '../learn/BadgeRow';
import { HEADER_CHIP } from '../learn/pcicStyles';
import { ProgressBar } from '../grammar/Themed';

jest.setTimeout(30000);

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

// ThemeProvider reads the palette from the database after its first render (see chromeBrutal.test.tsx).
const SETTLE = { timeout: 5000 };

// The flattened style of the BadgeRow row: the first ancestor of a label that sets flexWrap.
type TestNode = ReturnType<ReturnType<typeof render>['getByText']>;
const rowStyleOf = (label: TestNode) => {
  let node: TestNode | null = label.parent;
  while (node && StyleSheet.flatten(node.props.style)?.flexWrap === undefined) node = node.parent;
  return StyleSheet.flatten(node!.props.style);
};

const items = [{ label: 'total 12' }, { label: 'due 3', tone: 'blue' as const }, { label: 'XP 10/50', tone: 'accent' as const, tabular: true }];

describe('compact 💬 button', () => {
  it('compact is the level chip size, a button without it keeps 40x40', async () => {
    await getDb().setGrammarPalette('brand');
    const compact = render(wrap(<FeedbackButton placement="inline" compact level="B1" languagePair="es-en" currentCard="pcic" />));
    await waitFor(() => {
      const box = StyleSheet.flatten(compact.getByTestId('feedback-fab').props.style);
      expect(box.width).toBe(HEADER_CHIP.width);
      expect(box.height).toBe(HEADER_CHIP.height);
    }, SETTLE);
    compact.unmount();

    const plain = render(wrap(<FeedbackButton placement="inline" level="B1" languagePair="es-en" currentCard="pcic" />));
    await waitFor(() => {
      const box = StyleSheet.flatten(plain.getByTestId('feedback-fab').props.style);
      expect(box.width).toBe(40);
      expect(box.height).toBe(40);
    }, SETTLE);
    plain.unmount();
  });

  it('classic palette: compact is a pill the size of the level chip', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(wrap(<FeedbackButton placement="inline" compact level="B1" languagePair="es-en" currentCard="pcic" />));
    await waitFor(() => {
      const button = StyleSheet.flatten(view.getByLabelText('Feedback').props.style);
      expect(button.width).toBe(HEADER_CHIP.width);
      expect(button.height).toBe(HEADER_CHIP.height);
      expect(button.borderRadius).toBe(HEADER_CHIP.height / 2);
    }, SETTLE);
    view.unmount();
  });
});

describe('BadgeRow singleLine', () => {
  it.each(['brand', 'classic'] as const)('%s palette: singleLine does not wrap and every label is one fitted line', async (palette) => {
    await getDb().setGrammarPalette(palette);
    const view = render(wrap(<BadgeRow colors={Colors.light} items={items} singleLine />));
    await waitFor(() => {
      expect(rowStyleOf(view.getByText('total 12')).flexWrap).toBe('nowrap');
      for (const item of items) {
        const label = view.getByText(item.label);
        expect(label.props.numberOfLines).toBe(1);
        expect(label.props.adjustsFontSizeToFit).toBe(true);
        expect(label.props.minimumFontScale).toBe(0.7);
      }
    }, SETTLE);
    view.unmount();
  });

  it('without singleLine the row still wraps and the labels are not limited', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(wrap(<BadgeRow colors={Colors.light} items={items} />));
    await waitFor(() => {
      expect(rowStyleOf(view.getByText('total 12')).flexWrap).toBe('wrap');
      expect(view.getByText('total 12').props.numberOfLines).toBeUndefined();
    }, SETTLE);
    view.unmount();
  });
});

describe('ProgressBar continuous', () => {
  const bar = (pct: number, continuous: boolean) => (
    <ProgressBar
      testID="bar"
      continuous={continuous}
      pct={pct}
      trackColor="#eee"
      fillColor="#00f"
      fillProps={{ testID: 'bar-fill' }}
    />
  );

  it('brand palette: one track, the fill width is the percentage (clamped 0-100)', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(wrap(bar(40, true)));
    await waitFor(() => {
      expect(view.queryByTestId('bar-0')).toBeNull();
      expect(StyleSheet.flatten(view.getByTestId('bar-fill').props.style).width).toBe('40%');
    }, SETTLE);
    view.rerender(wrap(bar(150, true)));
    expect(StyleSheet.flatten(view.getByTestId('bar-fill').props.style).width).toBe('100%');
    view.rerender(wrap(bar(-5, true)));
    expect(StyleSheet.flatten(view.getByTestId('bar-fill').props.style).width).toBe('0%');
    view.unmount();
  });

  it('brand palette: without continuous the blocks stay (8 segments)', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(wrap(bar(50, false)));
    await waitFor(() => {
      expect(view.queryByTestId('bar-7')).toBeTruthy();
      expect(view.queryByTestId('bar-fill')).toBeNull();
    }, SETTLE);
    view.unmount();
  });

  it('classic palette: continuous changes nothing, the track + fill stay', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(wrap(bar(40, true)));
    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByTestId('bar-fill').props.style).width).toBe('40%');
    }, SETTLE);
    view.unmount();
  });
});
