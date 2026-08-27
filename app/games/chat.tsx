import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getChats, cumulativeCorpusWordIds, type ChatData, type ChatEnding } from '@/lib/games/content';
import { availableOptions, findNode, pickEnding } from '@/lib/games/chat';
import { buildGlossMap } from '@/lib/games/gloss';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { loadVoices, hasVoiceFor, speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';

// GAMES.md 4.6 (F4, chat): tanácsadó beszélgetés valódi tudással, K24 szerint
// újratervezve. A setup-kérdések (ha vannak) állapotot adnak (`context`), a
// `nodes[0]` mindig a belépési pont, az ág szét a `requires`-gate-elt
// opciókon dől el (lásd lib/games/content.ts JEGYZET). K28: a checklist
// MENET KÖZBEN töltődik (fejléc `X / Y` sáv), a végén a teljes lista látszik,
// a kihagyott pontok kiemelve, forrásokkal. K3: csak `game_progress` +
// `game_scores`, a `cards` tábla érintetlen.

type Screen = 'topics' | 'setup' | 'chat' | 'ending' | 'checklistView';

interface HistoryLine {
  speaker: 'npc' | 'user';
  text: string;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('chat')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');

  const [chats, setChats] = useState<ChatData[]>([]);
  const [progressByTopic, setProgressByTopic] = useState<Map<string, { achievedIds: string[]; endingId?: string }>>(new Map());
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('topics');
  const [canSpeak, setCanSpeak] = useState(false);

  const [chat, setChat] = useState<ChatData | null>(null);

  const [setupIndex, setSetupIndex] = useState(0);
  const [setupAnswers, setSetupAnswers] = useState<Record<string, string>>({});

  const [nodeId, setNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryLine[]>([]);
  const [achieved, setAchieved] = useState<Set<string>>(new Set());
  const [ending, setEnding] = useState<ChatEnding | undefined>(undefined);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    setChats(getChats(target));

    const progress = await db.getGameProgress('chat');
    const map = new Map<string, { achievedIds: string[]; endingId?: string }>();
    for (const p of progress) {
      const d = p.data as { achievedIds?: string[]; endingId?: string } | undefined;
      map.set(p.itemId, { achievedIds: d?.achievedIds ?? [], endingId: d?.endingId });
    }
    setProgressByTopic(map);

    const bestRow = await getGameBest('chat');
    setBest(bestRow?.bestScore ?? 0);

    await loadVoices();
    setCanSpeak(hasVoiceFor(speechLang(target)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startTopic = (c: ChatData) => {
    setChat(c);
    setSetupAnswers({});
    setSetupIndex(0);
    setAchieved(new Set());
    setEnding(undefined);
    if (c.setup.length === 0) {
      beginConversation(c, {});
    } else {
      setScreen('setup');
    }
  };

  const beginConversation = (c: ChatData, context: Record<string, string>) => {
    const first = c.nodes[0];
    setNodeId(first?.id ?? null);
    const firstText = first?.npc[learnedLang] ?? (first ? Object.values(first.npc)[0] : '');
    setHistory(first ? [{ speaker: 'npc', text: firstText }] : []);
    setScreen('chat');
  };

  const pickSetupOption = (value: string) => {
    if (!chat) return;
    const q = chat.setup[setupIndex];
    const next = { ...setupAnswers, [q.id]: value };
    setSetupAnswers(next);
    if (setupIndex + 1 < chat.setup.length) {
      setSetupIndex((i) => i + 1);
    } else {
      beginConversation(chat, next);
    }
  };

  const currentNode = useMemo(() => (chat && nodeId ? findNode(chat, nodeId) : undefined), [chat, nodeId]);
  const currentOptions = useMemo(
    () => (currentNode ? availableOptions(currentNode, setupAnswers) : []),
    [currentNode, setupAnswers]
  );

  useEffect(() => {
    if (screen !== 'chat' || !canSpeak) return;
    const last = history[history.length - 1];
    if (last?.speaker === 'npc' && last.text) speak(last.text, speechLang(learnedLang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, history.length, canSpeak]);

  const finishConversation = (finalAchieved: Set<string>) => {
    if (!chat) return;
    const picked = pickEnding(chat, finalAchieved.size);
    setEnding(picked);
    const data = { achievedIds: [...finalAchieved], endingId: picked?.id };
    getDb().setGameProgress('chat', chat.id, 'done', data).catch(() => {});
    recordGameResult('chat', finalAchieved.size).then((r) => setBest(r.best));
    setProgressByTopic((prev) => new Map(prev).set(chat.id, { achievedIds: [...finalAchieved], endingId: picked?.id }));
    setScreen('ending');
  };

  const pickOption = (optText: string, checklistId: string | undefined, next: string | undefined) => {
    if (!chat) return;
    const nextAchieved = checklistId ? new Set(achieved).add(checklistId) : achieved;
    if (checklistId) setAchieved(nextAchieved);

    const withUser = [...history, { speaker: 'user' as const, text: optText }];

    if (next) {
      const nextNode = findNode(chat, next);
      const nextOpts = nextNode ? availableOptions(nextNode, setupAnswers) : [];
      if (nextNode && nextOpts.length > 0) {
        const npcText = nextNode.npc[learnedLang] ?? Object.values(nextNode.npc)[0];
        setHistory([...withUser, { speaker: 'npc', text: npcText }]);
        setNodeId(next);
        return;
      }
    }
    setHistory(withUser);
    finishConversation(nextAchieved);
  };

  const knownIds = chat ? cumulativeCorpusWordIds(chat.level, learnedLang) : new Set<number>();
  const overrides = useMemo(
    () => Object.fromEntries((chat?.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss])),
    [chat]
  );

  if (chats.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.chat.comingSoon}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'topics' || !chat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.games.chat.pickTopic}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {chats.map((c) => {
            const prog = progressByTopic.get(c.id);
            return (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Pressable style={styles.cardMain} onPress={() => startTopic(c)}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{c.title[contentLang] ?? c.title.en}</Text>
                  <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
                    {s.games.chat.checklistLabel(c.checklist.length)}
                  </Text>
                  {prog ? (
                    <Text style={[styles.cardDone, { color: '#22C55E' }]}>
                      ✓ {s.games.chat.checklistProgress(prog.achievedIds.length, c.checklist.length)}
                    </Text>
                  ) : null}
                </Pressable>
                {prog ? (
                  <Pressable
                    style={[styles.viewChecklistBtn, { borderColor: colors.tint }]}
                    onPress={() => {
                      setChat(c);
                      setAchieved(new Set(prog.achievedIds));
                      setEnding(c.endings.find((e) => e.id === prog.endingId));
                      setScreen('checklistView');
                    }}
                  >
                    <Text style={[styles.viewChecklistText, { color: colors.tint }]}>{s.games.chat.viewChecklistBtn}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (screen === 'setup') {
    const q = chat.setup[setupIndex];
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setScreen('topics')} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {chat.title[contentLang] ?? chat.title.en}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.setupBody}>
          <Text style={[styles.setupPrompt, { color: colors.text }]}>{q.prompt[contentLang] ?? Object.values(q.prompt)[0]}</Text>
          {q.options.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.setupOption, { borderColor: colors.tint }]}
              onPress={() => pickSetupOption(opt.value)}
            >
              <Text style={[styles.setupOptionText, { color: colors.text }]}>{opt.label[learnedLang] ?? Object.values(opt.label)[0]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (screen === 'ending' || screen === 'checklistView') {
    const total = chat.checklist.length;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setScreen('topics')} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {chat.title[contentLang] ?? chat.title.en}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.endingBody}>
          {ending ? (
            <>
              <Text style={[styles.endingTitle, { color: colors.text }]}>{ending.title[contentLang] ?? Object.values(ending.title)[0]}</Text>
              <Text style={[styles.cardSub, { color: colors.tint }]}>{s.games.chat.checklistProgress(achieved.size, total)}</Text>
            </>
          ) : null}
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {s.games.best}: {best}
          </Text>

          <Text style={[styles.endingChecklistHeader, { color: colors.text }]}>{s.games.chat.endingChecklistHeader}</Text>
          {chat.checklist.map((item) => {
            const got = achieved.has(item.id);
            return (
              <View
                key={item.id}
                style={[
                  styles.checklistRow,
                  { backgroundColor: colors.card, borderColor: got ? '#22C55E' : '#F59E0B' },
                ]}
              >
                <Text style={[styles.checklistMark, { color: got ? '#22C55E' : '#F59E0B' }]}>{got ? '✓' : '!'}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.checklistTag, { color: got ? '#22C55E' : '#F59E0B' }]}>
                    {got ? s.games.chat.achievedTag : s.games.chat.missedTag}
                  </Text>
                  <Text style={[styles.checklistText, { color: colors.text }]}>{item[contentLang] as string ?? item.hu}</Text>
                  <Text style={[styles.checklistWhy, { color: colors.tabIconDefault }]}>{item.why[contentLang] ?? item.why.en}</Text>
                  <Pressable onPress={() => item.source.url && Linking.openURL(item.source.url)} disabled={!item.source.url}>
                    <Text style={[styles.checklistSource, { color: colors.tabIconDefault }]}>
                      {s.games.chat.sourceLabel} {item.source.label}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.summaryButtons}>
            <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.tint }]} onPress={() => setScreen('topics')}>
              <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={() => startTopic(chat)}>
              <Text style={styles.btnText}>{s.games.playAgain}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // screen === 'chat'
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('topics')} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {chat.title[contentLang] ?? chat.title.en}
        </Text>
        <Text style={[styles.checklistBadge, { color: colors.tint }]}>
          {s.games.chat.checklistProgress(achieved.size, chat.checklist.length)}
        </Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.chatBody} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {history.map((line, i) => {
          const isNpc = line.speaker === 'npc';
          return (
            <View key={i} style={[styles.bubbleRow, isNpc ? styles.bubbleRowLeft : styles.bubbleRowRight]}>
              {isNpc ? (
                <View style={[styles.bubble, styles.bubbleNpc, { backgroundColor: colors.card }]}>
                  <GlossText
                    text={line.text}
                    glosses={buildGlossMap(line.text, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                    learnedLang={learnedLang}
                    style={[styles.bubbleText, { color: colors.text }]}
                  />
                </View>
              ) : (
                <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: colors.tint }]}>
                  <Text style={[styles.bubbleText, styles.bubbleUserText]}>{line.text}</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.options}>
          {currentOptions.map((opt, i) => {
            const optText = (opt[learnedLang] as string) ?? '';
            return (
              <Pressable
                key={optText + i}
                style={[styles.optionBtn, { borderColor: colors.tint }]}
                onPress={() => pickOption(optText, opt.checklist, opt.next)}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{optText}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 4 },
  checklistBadge: { fontSize: 14, fontWeight: '700' },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 14, gap: 6 },
  cardMain: { gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 12 },
  cardDone: { fontSize: 12, fontWeight: '700' },
  viewChecklistBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  viewChecklistText: { fontSize: 12, fontWeight: '600' },
  setupBody: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  setupPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  setupOption: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  setupOptionText: { fontSize: 16, fontWeight: '600' },
  chatBody: { padding: 16, gap: 10, paddingBottom: 32 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleNpc: { borderTopLeftRadius: 4 },
  bubbleUser: { borderTopRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleUserText: { color: '#FFFFFF' },
  options: { gap: 10, marginTop: 8 },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  optionText: { fontSize: 15 },
  endingBody: { padding: 20, gap: 10 },
  endingTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  endingChecklistHeader: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  checklistRow: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 8 },
  checklistMark: { fontSize: 18, fontWeight: '800', width: 20, textAlign: 'center' },
  checklistTag: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  checklistText: { fontSize: 14, fontWeight: '600' },
  checklistWhy: { fontSize: 13, lineHeight: 18 },
  checklistSource: { fontSize: 11, fontStyle: 'italic' },
  summaryButtons: { flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'center' },
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});
