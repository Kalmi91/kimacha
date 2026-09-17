// Design-tokenek, forrás: DESIGN.md. Új kód csak innen vesz méretet, ne inline számot.

import type { ViewStyle } from 'react-native';
import Colors from './Colors';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, full: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;
export const lineHeight = { xs: 16, sm: 20, md: 22, lg: 25, xl: 28, xxl: 34 } as const;
export const fontWeight = { regular: '400', semibold: '600', bold: '700' } as const;
export const tapTarget = 44;
export const motion = { micro: 150, enter: 250, feedback: 300, pause: 600 } as const;
export const shadow: Record<'card' | 'modal', ViewStyle> = {
  card: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  modal: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
};
export type ThemeColors = typeof Colors.light;
export { Colors };
