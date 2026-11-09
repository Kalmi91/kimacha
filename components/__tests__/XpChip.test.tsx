// FB624, FB630: the XP chip shows only "XP n/50" (no "+N XP" text when XP was earned); `flush` drops its side padding.

import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import XpChip from '../XpChip';

describe('XpChip', () => {
  it('earned=2 shows no "+2 XP"', () => {
    const { queryByText, toJSON } = render(<XpChip earned={2} />);
    expect(queryByText(/\+\s?2/)).toBeNull();
    expect(JSON.stringify(toJSON())).not.toMatch(/\+2 XP/);
  });

  it('flush drops the side padding, the default keeps 16', () => {
    const padding = (flush: boolean) => {
      const { toJSON } = render(<XpChip flush={flush} />);
      const root = toJSON() as unknown as { props: { style: object } };
      return (StyleSheet.flatten(root.props.style) as { paddingHorizontal?: number }).paddingHorizontal;
    };
    expect(padding(false)).toBe(16);
    expect(padding(true)).toBeUndefined();
  });
});
