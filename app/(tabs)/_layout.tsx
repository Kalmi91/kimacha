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
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.learn,
          // FB123: "a fent Learn rész az felesleges azt vedd ki van ott egy centi
          // ami nem kell oda". The learning screen draws its own header row, so
          // the navigator title was only eating vertical space.
          headerShown: false,
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
        name="games"
        options={{
          title: s.tabs.games,
          // A hub saját fejlécet rajzol, mint az index (FB123-minta).
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: s.tabs.active,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: s.tabs.tree,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }}
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
