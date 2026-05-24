import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

type Theme = 'light' | 'dark';
type ThemeOverride = Theme | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  override: ThemeOverride;
  setOverride: (o: ThemeOverride) => void;
}>({ theme: 'dark', override: 'system', setOverride: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const raw = useSystemScheme();
  const systemScheme: Theme = raw === 'light' ? 'light' : 'dark';
  const [override, setOverride] = useState<ThemeOverride>('system');
  const theme: Theme = override === 'system' ? systemScheme : override;

  return (
    <ThemeContext.Provider value={{ theme, override, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
