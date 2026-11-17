// Settings, Voice folder: the "Recordings: both speakers" card must not put its text in a row next to the
// wide download button (on a ~274 dp screen the text got 1-3 characters per line). Text and button share
// one column, so the row has a single child.

import { View } from 'react-native';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import BetterVoiceRows from '../BetterVoiceRows';

const mockState = {
  supported: true,
  ready: true,
  enabled: true,
  engines: { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' },
  installed: Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true])),
  download: { running: false, percent: 0, phase: 'download', failed: [] },
  issues: {},
};
jest.mock('@/lib/neuralModels', () => ({
  downloadNeural: jest.fn(),
  setNeuralEnabled: jest.fn(),
  setNeuralEngine: jest.fn(),
  useNeuralState: () => mockState,
}));

const Row = ({ children }: { children: React.ReactNode }) => <View testID="row">{children}</View>;

describe('BetterVoiceRows: recordings card on a narrow screen', () => {
  it('keeps the text and the download button in one column, not side by side in the row', () => {
    const view = render(
      <ThemeProvider>
        <BetterVoiceRows Row={Row} />
      </ThemeProvider>,
    );
    const row = view.getAllByTestId('row').find(r => r.findAll(n => n.props?.testID === 'settings-recordings-download').length > 0);
    expect(row).toBeTruthy();
    expect(row!.children).toHaveLength(1);
  });
});
