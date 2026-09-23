import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.card,
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
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'list.bullet', android: 'list', web: 'list' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: s.tabs.grammar,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'book.fill', android: 'book', web: 'book' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: s.tabs.stats,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s.tabs.settings,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
