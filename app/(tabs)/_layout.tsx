import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
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
import { useBeta } from '@/lib/beta';
import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import { ScreenFeedbackFrame } from '@/lib/screenFeedback';

type TabOptions = Exclude<NonNullable<ComponentProps<typeof Tabs.Screen>['options']>, (...args: never[]) => unknown>;
type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];

export default function TabLayout() {
  const { theme, grammarPalette } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const { skin } = useSkin();
  const { HeaderOrnament } = useSkinDecor();
  const s = t();
  // the two beta tabs are hidden (href: null) while their switch is off.
  const showPractice = useBeta('practiceTab');
  const showSentences = useBeta('sentenceTab');

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

  // The bar's own button with ONE icon. React Navigation draws every icon twice and fades between them (opacity 1 <-> 0);
  // Fabric flattens and rebuilds those wrappers on each tab switch, and a switch during a busy render crashed the app
  // ("Unable to find viewState for tag", emulator 2026-10-22: 3 of 8 switches, 0 of 12 without the wrappers).
  // React Navigation calls it as a function (button(props)), so it is not a component of its own.
  const tabButton = (name: SymbolViewProps['name']) =>
    function TabBarButton({ children: _drawnTwice, style, href: _href, ref: _ref, ...rest }: TabButtonProps) {
      const focused = rest['aria-selected'] === true;
      return (
        <Pressable {...rest} style={style}>
          <View style={styles.iconSlot}>{tabIcon(name, focused ? colors.tint : colors.tabIconDefault, focused)}</View>
        </Pressable>
      );
    };

  return (
    <Tabs
      // every screen can put its 💬 button into its header (headerRight), see lib/feedbackHeader.tsx; the frame draws it
      // from the card the screen names (lib/screenFeedback.tsx)
      screenLayout={({ navigation, children }) => (
        <FeedbackHeaderProvider navigation={navigation}>
          <ScreenFeedbackFrame>{children}</ScreenFeedbackFrame>
        </FeedbackHeaderProvider>
      )}
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
          tabBarAccessibilityLabel: s.tabs.pcic,
          // Draws its own header, as before.
          headerShown: false,
          tabBarButton: tabButton({ ios: 'list.bullet', android: 'list', web: 'list' }),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: s.tabs.grammar,
          tabBarAccessibilityLabel: s.tabs.grammar,
          // the brutalist course list draws its own header (title + streak sticker).
          headerShown: grammarPalette === 'classic',
          tabBarButton: tabButton({ ios: 'book.fill', android: 'book', web: 'book' }),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: s.tabs.practice,
          tabBarAccessibilityLabel: s.tabs.practice,
          ...(showPractice ? { tabBarButton: tabButton({ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }) } : { href: null }),
        }}
      />
      <Tabs.Screen
        name="sentences"
        options={{
          title: s.tabs.sentences,
          tabBarAccessibilityLabel: s.tabs.sentences,
          ...(showSentences ? { tabBarButton: tabButton({ ios: 'text.bubble.fill', android: 'chat', web: 'chat' }) } : { href: null }),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: s.tabs.stats,
          tabBarAccessibilityLabel: s.tabs.stats,
          tabBarButton: tabButton({ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s.tabs.settings,
          tabBarAccessibilityLabel: s.tabs.settings,
          tabBarButton: tabButton({ ios: 'gearshape.fill', android: 'settings', web: 'settings' }),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // the place React Navigation gives the icon (uikit variant, 31 x 28), so the icon sits where it did before
  iconSlot: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
});
