import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

export default function TabLayout() {
  const { theme, grammarPalette } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  // NY19: brutalista palettán az aktív ikon a kitöltésű, ink keretes négyzeten ül.
  const tabIcon = (name: SymbolViewProps['name'], color: ColorValue, focused: boolean) => {
    const symbol = <SymbolView name={name} tintColor={g.brutal && focused ? g.onFill : color} size={28} />;
    if (!g.brutal) return symbol;
    return (
      <View
        testID={focused ? 'tab-icon-active' : undefined}
        style={{ padding: 2, borderWidth: 2, borderColor: focused ? g.ink : 'transparent', backgroundColor: focused ? g.a : 'transparent' }}
      >
        {symbol}
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.card,
          // NY19: brutalista palettán felső 2,5 px ink vonal.
          ...(g.brutal ? { borderTopColor: g.ink, borderTopWidth: 2.5 } : null),
        },
        // FB175: with the window resizing for the keyboard, a visible tab bar would
        // sit between the learn card's docked Check and the keys. It steps aside
        // while typing and comes back when the keyboard closes.
        tabBarHideOnKeyboard: true,
        // K1 DÖNTÉS (GAMES.md 2.1): 6 fül fér a sávba, de 360 dp széles
        // kijelzőn a felirat 6 fülnél tördel a default méretnél.
        tabBarLabelStyle: {
          fontSize: 10,
        },
        // Az Átbeszélő a 7. fül (Kálmán döntése, 2026-09-08). 7 feliratot már
        // nem lehet kiolvasni 360 dp-n, ezért a sáv innentől csak ikon. A
        // feliratok maguk megmaradnak (s.tabs.*), a képernyők fejlécében.
        tabBarShowLabel: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.pcic,
          // Saját fejlécet rajzol, mint korábban is (FB123-minta).
          headerShown: false,
          tabBarIcon: ({ color, focused }) => tabIcon({ ios: 'list.bullet', android: 'list', web: 'list' }, color, focused),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: s.tabs.grammar,
          // NY21: a brutalista kurzus-lista saját fejlécet rajzol (cím + streak-matrica).
          headerShown: grammarPalette === 'classic',
          tabBarIcon: ({ color, focused }) => tabIcon({ ios: 'book.fill', android: 'book', web: 'book' }, color, focused),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: s.tabs.stats,
          tabBarIcon: ({ color, focused }) => tabIcon({ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }, color, focused),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s.tabs.settings,
          tabBarIcon: ({ color, focused }) => tabIcon({ ios: 'gearshape.fill', android: 'settings', web: 'settings' }, color, focused),
        }}
      />
    </Tabs>
  );
}
