import { View, type ColorValue } from 'react-native';
import { Text } from '@/components/KText';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { brutalHeaderOptions } from '@/lib/brutalHeader';
import { useSkinDecor } from '@/components/skins';
import { t } from '@/lib/i18n';

export default function TabLayout() {
  const { theme, grammarPalette } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const { skin } = useSkin();
  const { HeaderOrnament } = useSkinDecor();
  const s = t();

  // On the brutalist palette the active icon sits on a filled square with an ink border.
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
          // On the brutalist palette a 2.5 px ink line at the top.
          ...(g.brutal ? { borderTopColor: g.ink, borderTopWidth: 2.5 } : null),
        },
        // with the window resizing for the keyboard, a visible tab bar would
        // sit between the learn card's docked Check and the keys. It steps aside
        // while typing and comes back when the keyboard closes.
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          // the tab label takes the theme's title font.
          ...(skin.fonts.title ? { fontFamily: skin.fonts.title } : null),
        },
        // The bar is icon-only; the labels (s.tabs.*) are in the screens' headers.
        tabBarShowLabel: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        // On the brutalist palette an ink-lined, uppercase header (classic: empty).
        ...brutalHeaderOptions(g, skin),
        // ornament header (HeaderOrnament); without an ornament the native title stays.
        ...(HeaderOrnament
          ? {
              headerTitle: ({ children }: { children: string }) => (
                <HeaderOrnament>
                  <Text
                    variant="title"
                    style={
                      g.brutal
                        ? { color: g.ink, fontSize: 17, fontWeight: '500', textTransform: 'uppercase' }
                        : { color: colors.text, fontSize: 17, fontWeight: '600' }
                    }
                  >
                    {children}
                  </Text>
                </HeaderOrnament>
              ),
            }
          : null),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.pcic,
          // Draws its own header, as before.
          headerShown: false,
          tabBarIcon: ({ color, focused }) => tabIcon({ ios: 'list.bullet', android: 'list', web: 'list' }, color, focused),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: s.tabs.grammar,
          // the brutalist course list draws its own header (title + streak sticker).
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
