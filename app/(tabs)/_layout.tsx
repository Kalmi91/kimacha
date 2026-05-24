import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { t } from '@/lib/i18n';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const s = t();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].background,
          borderTopColor: Colors[colorScheme].card,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme].background,
        },
        headerTintColor: Colors[colorScheme].text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.learn,
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
    </Tabs>
  );
}
