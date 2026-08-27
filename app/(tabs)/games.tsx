import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { wordPhase } from '@/lib/wordPhase';
import { GAME_DEFS, gameName, gameBlurb, gameRoute, gameSupportsLanguage, type GameDef } from '@/lib/games/registry';
import { getGameBest } from '@/lib/games/scoring';
import FeedbackButton from '@/components/FeedbackModal';

// GAMES.md 2.2: a Game fül hub képernyője. A kártyarács a registryből rajzol
// (lib/games/registry.ts), új játék = egy registry-bejegyzés + egy
// app/games/<id>.tsx képernyő, itt semmi nem változik.
//
// F0 (GAMES.md 5. szekció): egyetlen játék-képernyő sincs kész, ezért minden
// kártya `soon: true` (lib/games/registry.ts) és "Hamarosan" jelvényt kap,
// koppintásra nem navigál. Egy játék, amint elkészül, a registry-ben
// `soon: false`-ra vált, és a lenti kártya-logika onnantól élesben fut
// (rekord / zárolt-N-szó-kell állapot, koppintás a screen-re navigál).

const THIN_POOL_THRESHOLD = 30;

export default function GamesScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [level, setLevel] = useState('A1');
  const [pair, setPair] = useState('hu-es');
  const [contentLang, setContentLang] = useState('hu');
  const [learnedLang, setLearnedLang] = useState('es');
  const [poolSize, setPoolSize] = useState(0);
  const [bestByGame, setBestByGame] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const activePair = onboarding ? `${onboarding.source}-${onboarding.target}` : 'hu-es';
    setPair(activePair);
    setLearnedLang(onboarding?.target ?? 'es');
    // Same fallback ladder as app/(tabs)/tree.tsx's uiLang: game names/blurbs
    // are content, they read in the learner's own language, not app chrome.
    setContentLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');

    const levelData = await db.getLevel();
    setLevel(levelData.level);

    const cards = await db.getAllWordCards(activePair);
    setPoolSize(cards.filter((c) => wordPhase(c) >= 1).length);

    const entries = await Promise.all(
      GAME_DEFS.filter((g) => !g.soon).map(async (g) => {
        const best = await getGameBest(g.id);
        return [g.id, best?.bestScore ?? 0] as const;
      })
    );
    setBestByGame(new Map(entries));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePress = (game: GameDef) => {
    if (game.soon || !gameSupportsLanguage(game, learnedLang)) return;
    if (game.minPoolSize && poolSize < game.minPoolSize) return;
    router.push(gameRoute(game.id) as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{s.games.title}</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.games.subtitle}</Text>
        <Text style={[styles.poolLine, { color: colors.text }]}>
          {poolSize < THIN_POOL_THRESHOLD ? s.games.poolLineThin(poolSize) : s.games.poolLine(poolSize)}
        </Text>

        <View style={styles.grid}>
          {GAME_DEFS.map((game) => {
            const unsupportedLang = !gameSupportsLanguage(game, learnedLang);
            const locked = !game.soon && !unsupportedLang && !!game.minPoolSize && poolSize < game.minPoolSize;
            const showSoon = game.soon || unsupportedLang;
            const disabled = showSoon || locked;
            const best = bestByGame.get(game.id);

            return (
              <Pressable
                key={game.id}
                style={[styles.card, { backgroundColor: colors.card }, disabled ? styles.cardDisabled : null]}
                onPress={() => handlePress(game)}
              >
                <Text style={styles.icon}>{game.icon}</Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {gameName(game, contentLang)}
                </Text>
                <Text style={[styles.blurb, { color: colors.tabIconDefault }]} numberOfLines={2}>
                  {gameBlurb(game, contentLang)}
                </Text>
                <View style={styles.cardFooter}>
                  {showSoon ? (
                    <Text style={[styles.badge, { color: colors.tabIconDefault }]}>{s.games.comingSoon}</Text>
                  ) : locked ? (
                    <Text style={[styles.badge, { color: colors.tabIconDefault }]}>
                      {s.games.locked(Math.max(0, (game.minPoolSize ?? 0) - poolSize))}
                    </Text>
                  ) : (
                    <Text style={[styles.badge, { color: colors.tint }]}>
                      {s.games.best}: {best ?? 0}
                    </Text>
                  )}
                  {game.hasSettings && !disabled ? <Text style={styles.gear}>⚙️</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.games.newWordHint}</Text>
      </ScrollView>
      <FeedbackButton level={level} languagePair={pair} currentCard="games-hub" />
    </View>
  );
}

const CARD_GAP = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 96,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  poolLine: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  icon: {
    fontSize: 32,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  blurb: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
  },
  gear: {
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
});
