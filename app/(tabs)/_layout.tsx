import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { Text } from '@/components/KText';
import { Tabs } from 'expo-router';
import { HeaderTitle, useRoute } from 'expo-router/react-navigation';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { BetaSticker } from '@/components/BetaSticker';
import Colors from '@/constants/Colors';
import lightWeight from 'expo-symbols/androidWeights/light';

import { useTheme } from '@/lib/ThemeContext';
import { gradientStyle } from '@/lib/gradientStyle';
import { useGrammarColors } from '@/lib/grammarColors';
import { softTitleStyle } from '@/components/grammar/Brutal';
import { useSkin } from '@/lib/useSkin';
import { brutalHeaderOptions } from '@/lib/brutalHeader';
import { useSkinDecor } from '@/components/skins';
import { t } from '@/lib/i18n';
import { useHasSession } from '@/lib/cloud/useHasSession';
import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import { ScreenFeedbackFrame } from '@/lib/screenFeedback';
import { useWebKeyboardOpen } from '@/lib/webKeyboard';

type TabOptions = Exclude<NonNullable<ComponentProps<typeof Tabs.Screen>['options']>, (...args: never[]) => unknown>;
type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];

function TabHeaderTitle({ onLayout, ...props }: ComponentProps<typeof HeaderTitle>) {
  const { name } = useRoute();
  const beta = name === 'sentences' || name === 'speak' || name === 'exam-tab' || name === 'practice';
  const { theme } = useTheme();
  const g = useGrammarColors();
  const { HeaderOrnament } = useSkinDecor();
  const title = HeaderOrnament ? (
    <HeaderOrnament>
      <Text
        variant="title"
        numberOfLines={beta ? 1 : undefined}
        style={[
          g.brutal
            ? { color: g.ink, fontSize: 17, fontWeight: '500', textTransform: 'uppercase' }
            : { color: Colors[theme].text, fontSize: 17, fontWeight: '600' },
          softTitleStyle(g),
          beta && styles.headerTitle,
        ]}
      >
        {props.children}
      </Text>
    </HeaderOrnament>
  ) : (
    <HeaderTitle {...props} onLayout={beta ? undefined : onLayout} />
  );
  if (!beta) return title;
  return (
    <View onLayout={onLayout} style={styles.headerRow}>
      <View style={styles.headerTitle}>{title}</View>
      <BetaSticker testID={`beta-sticker-${name}`} />
    </View>
  );
}

export default function TabLayout() {
  const { theme, grammarPalette } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const { skin } = useSkin();
  const s = t();
  // the weekly leaderboard needs a cloud account on web; the tab follows login and logout
  const hasSession = useHasSession();
  const webKeyboardOpen = useWebKeyboardOpen();

  // On the brutalist palette the active icon sits on a filled square with an ink border.
  // Night (skin.tabIcons 'alt'): Light-weight alternative icons, the active one in a pink-cyan capsule.
  const alt = skin.tabIcons === 'alt' && !!g.soft;
  const tabIcon = (name: SymbolViewProps['name'], color: ColorValue, focused: boolean) => {
    if (alt) {
      const light = { ios: 'light', android: lightWeight } as const;
      if (!focused) return <SymbolView name={name} tintColor={g.mu} size={28} weight={light} />;
      return (
        <View testID="tab-icon-active" style={[styles.capsule, gradientStyle(g.a, g.b)]}>
          <SymbolView name={name} tintColor={g.onA} size={28} weight={light} />
        </View>
      );
    }
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
  const tabButton = (baseName: SymbolViewProps['name'], altName?: string) =>
    function TabBarButton({ children: _drawnTwice, style, href: _href, ref: _ref, ...rest }: TabButtonProps) {
      const focused = rest['aria-selected'] === true;
      const name: SymbolViewProps['name'] = alt && altName && typeof baseName === 'object' ? { ...baseName, android: altName, web: altName } as SymbolViewProps['name'] : baseName;
      return (
        <Pressable {...rest} style={style}>
          <View style={[styles.iconSlot, alt && styles.iconSlotAlt]}>{tabIcon(name, focused ? colors.tint : colors.tabIconDefault, focused)}</View>
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
          // Night: its own bar colour, a 1 px border line and rounded top corners.
          ...(alt ? { backgroundColor: g.extra.tabBar ?? colors.background, borderTopColor: g.border, borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 } : null),
          // tabBarHideOnKeyboard listens for Keyboard events, which the web build never gets.
          ...(webKeyboardOpen ? { display: 'none' } : null),
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
        // StatusBarStrip (app/_layout.tsx) already fills the status bar above the navigator, so the header must not add
        // the status bar inset a second time: it showed as an empty band above the title of every tab with this header.
        headerStatusBarHeight: 0,
        // On the brutalist palette an ink-lined, uppercase header (classic: empty).
        ...brutalHeaderOptions(g, skin),
        // Keep one shared header; its route decides whether the title needs a beta sticker.
        headerTitle: (props) => <TabHeaderTitle {...props} />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.pcic,
          tabBarAccessibilityLabel: s.tabs.pcic,
          // Draws its own header, as before.
          headerShown: false,
          tabBarButton: tabButton({ ios: 'list.bullet', android: 'list', web: 'list' }, 'school'),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: s.tabs.grammar,
          tabBarAccessibilityLabel: s.tabs.grammar,
          // the brutalist course list draws its own header (title + streak sticker).
          headerShown: grammarPalette === 'classic',
          tabBarButton: tabButton({ ios: 'book.fill', android: 'book', web: 'book' }, 'menu_book'),
        }}
      />
      <Tabs.Screen
        name="sentences"
        options={{
          title: s.tabs.sentences,
          tabBarAccessibilityLabel: s.tabs.sentences,
          tabBarButton: tabButton({ ios: 'text.bubble.fill', android: 'chat', web: 'chat' }, 'forum'),
        }}
      />
      <Tabs.Screen
        name="speak"
        options={{
          title: s.tabs.speak,
          tabBarAccessibilityLabel: s.tabs.speak,
          tabBarButton: tabButton({ ios: 'mic.fill', android: 'mic', web: 'mic' }, 'record_voice_over'),
        }}
      />
      <Tabs.Screen
        name="exam-tab"
        // hidden from the tab bar (2026-11-18); Level exam / mock exam open from Learn and Stats.
        // No tabBarButton: expo-router throws when `href` and `tabBarButton` are set together.
        options={{
          href: null,
          title: s.tabs.exam,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: s.tabs.practice,
          tabBarAccessibilityLabel: s.tabs.practice,
          tabBarButton: tabButton({ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, 'exercise'),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: s.tabs.board,
          tabBarAccessibilityLabel: s.tabs.board,
          // draws its own header (band + title + feedback button)
          headerShown: false,
          // a guest on web has no cloud account, so no board (the same condition the old Stats card hid itself with)
          ...(Platform.OS === 'web' && !hasSession ? { href: null } : { tabBarButton: tabButton({ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }, 'trophy') }),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: s.tabs.stats,
          tabBarAccessibilityLabel: s.tabs.stats,
          tabBarButton: tabButton({ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }, 'monitoring'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s.tabs.settings,
          tabBarAccessibilityLabel: s.tabs.settings,
          tabBarButton: tabButton({ ios: 'gearshape.fill', android: 'settings', web: 'settings' }, 'tune'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  headerTitle: { flexShrink: 1, minWidth: 0 },
  // the place React Navigation gives the icon (uikit variant, 31 x 28), so the icon sits where it did before
  iconSlot: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
  iconSlotAlt: { width: 46, height: 32 },
  capsule: { width: 46, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
