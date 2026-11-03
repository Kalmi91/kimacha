import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/KText';
import { Card } from '@/components/grammar/Brutal';
import { ActionButton, themedInputStyle } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { boardToken, getBoard, joinBoard, leaveBoard, rejoinBoard, type BoardData, type BoardFailure } from '@/lib/cloud/board';
import { pushBoardNow } from '@/lib/cloud/boardSync';
import { loadSession } from '@/lib/cloud/session';
import { NAME_MAX, isValidName } from '@/lib/cloud/validate';
import { getDb } from '@/lib/database';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { useScreenLoad } from '@/lib/useScreenLoad';

// The Stats tab's weekly XP leaderboard (lib/cloud/board.ts). Native without a name: a join form (nothing goes up before the
// learner enters one). Web: the cloud account's name goes up on its own, a guest has no card. Joined: the own rank and a list
// that opens on tap. A web account that left sees the list and a join button without a name field. Every time the screen is
// focused the XP is pushed, then the board is read.
type Phase = 'loading' | 'join' | 'ready' | 'left' | 'offline' | 'hidden';

function joinError(failure: BoardFailure): string {
  const s = t().board;
  switch (failure.error) {
    case 'name_taken':
      return s.nameTaken;
    case 'bad_input':
      return s.badName;
    case 'locked':
      return s.tooManyJoins;
    default:
      return s.offline;
  }
}

export default function WeeklyBoardCard() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().board;
  // A guest on web has no card at all, so it never shows even for a moment.
  const [phase, setPhase] = useState<Phase>(() => (Platform.OS === 'web' && !loadSession() ? 'hidden' : 'loading'));
  const [data, setData] = useState<BoardData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await boardToken();
    if (!token) {
      setPhase(Platform.OS === 'web' ? 'hidden' : 'join');
      return;
    }
    await pushBoardNow();
    const res = await getBoard(token, localDateString());
    if (res.ok) {
      setData(res.data);
      setPhase(res.data.me && !res.data.left ? 'ready' : 'left');
    } else if (res.error === 'bad_token' && Platform.OS !== 'web') {
      // the server forgot this device: back to the join form
      await getDb().setBoardIdentity(null);
      setPhase('join');
    } else {
      setPhase('offline');
    }
  }, []);

  // After the first load the card refreshes quietly: no loading state over a form or a list that is already there.
  useScreenLoad(load, { hasData: phase !== 'loading' });

  const join = async () => {
    if (busy || !isValidName(name)) return;
    setBusy(true);
    setError(null);
    const res = await joinBoard(name);
    if (!res.ok) {
      setBusy(false);
      setError(joinError(res));
      return;
    }
    try {
      await getDb().setBoardIdentity({ token: res.data.token, name: res.data.displayName });
    } catch {
      setBusy(false);
      setError(s.offline);
      return;
    }
    setBusy(false);
    setPhase('loading');
    await load();
  };

  // Web: an account that left joins again under its account name (no name to enter).
  const rejoin = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const token = await boardToken();
    const res = token ? await rejoinBoard(token) : null;
    setBusy(false);
    if (res?.ok) {
      setPhase('loading');
      await load();
    } else {
      setError(res ? joinError(res) : s.offline);
    }
  };

  const doLeave = async () => {
    const token = await boardToken();
    if (token) {
      const res = await leaveBoard(token);
      // A failed delete keeps the identity: without the token the name could never be removed again.
      if (!res.ok && res.error !== 'bad_token') {
        setError(s.offline);
        return;
      }
    }
    setError(null);
    setExpanded(false);
    if (Platform.OS === 'web') {
      // the server now answers "left" and keeps the list; a web account has no identity of its own to drop
      setPhase('loading');
      await load();
      return;
    }
    await getDb().setBoardIdentity(null);
    setData(null);
    setName('');
    setPhase('join');
  };

  const confirmLeave = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${s.leave}\n${s.leaveConfirm}`)) void doLeave();
    } else {
      Alert.alert(s.leave, s.leaveConfirm, [
        { text: t().feedback.cancel, style: 'cancel' },
        { text: s.leaveYes, style: 'destructive', onPress: () => void doLeave() },
      ]);
    }
  };

  if (phase === 'hidden') return null;

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)];
  const canJoin = isValidName(name) && !busy;
  const title = <Text style={[styles.title, { color: colors.textMuted }]}>{s.title}</Text>;
  const list = data && (data.rows.every((r) => r.xp === 0) ? (
    <Text testID="board-empty" style={[styles.note, { color: colors.textMuted }]}>{s.empty}</Text>
  ) : (
    data.rows.map((r) => (
      <View
        key={`${r.rank}-${r.name}`}
        testID={r.me ? 'board-row-me' : `board-row-${r.rank}`}
        accessibilityState={{ selected: r.me }}
        style={[styles.row, r.me && { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.rank, { color: r.me ? colors.onTint : colors.textMuted }]}>{r.rank}</Text>
        <Text style={[styles.rowName, { color: r.me ? colors.onTint : colors.text }]} numberOfLines={1}>{r.name}</Text>
        <Text style={[styles.rowXp, { color: r.me ? colors.onTint : colors.text }]}>{s.xp(r.xp)}</Text>
      </View>
    ))
  ));
  const ranked = phase === 'ready' && data?.me ? data.me : null;
  return (
    <Card testID="weekly-board" classicStyle={styles.card} boxStyle={styles.brutalCard} style={styles.outer}>
      {phase === 'loading' && (
        <>
          {title}
          <Text testID="board-loading" style={[styles.note, { color: colors.textMuted }]}>{s.loading}</Text>
        </>
      )}
      {phase === 'offline' && (
        <>
          {title}
          <Text testID="board-offline" style={[styles.note, { color: colors.textMuted }]}>{s.offline}</Text>
        </>
      )}
      {phase === 'join' && (
        <>
          {title}
          <Text style={[styles.headline, { color: colors.text }]}>{s.joinPrompt}</Text>
          <TextInput
            testID="board-name"
            accessibilityLabel={s.namePlaceholder}
            style={inputStyle}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder={s.namePlaceholder}
            placeholderTextColor={colors.tabIconDefault}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={join}
          />
          <Text style={[styles.note, { color: colors.textMuted }]}>{s.joinWarning}</Text>
          {error ? <Text testID="board-error" style={[styles.note, { color: colors.danger }]}>{error}</Text> : null}
          <ActionButton
            testID="board-join"
            label={s.join}
            onPress={join}
            disabled={!canJoin}
            brutalStyle={styles.button}
            classicStyle={[styles.button, styles.classicButton, { backgroundColor: colors.tint, opacity: canJoin ? 1 : 0.4 }]}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
        </>
      )}
      {phase === 'left' && (
        <>
          {title}
          <View style={styles.list}>{list}</View>
          <Text style={[styles.note, { color: colors.textMuted }]}>{s.joinWarning}</Text>
          {error ? <Text testID="board-error" style={[styles.note, { color: colors.danger }]}>{error}</Text> : null}
          <ActionButton
            testID="board-rejoin"
            label={s.join}
            onPress={rejoin}
            disabled={busy}
            brutalStyle={styles.button}
            classicStyle={[styles.button, styles.classicButton, { backgroundColor: colors.tint, opacity: busy ? 0.4 : 1 }]}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
        </>
      )}
      {ranked && (
        <>
          <Pressable
            testID="board-toggle"
            accessibilityRole="button"
            accessibilityLabel={`${s.title}, ${s.rankLine(ranked.rank, ranked.xp)}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((v) => !v)}
            style={styles.head}
          >
            {title}
            <Text testID="board-rank" style={[styles.headline, { color: colors.text }]}>{s.rankLine(ranked.rank, ranked.xp)}</Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>{s.resets}</Text>
          </Pressable>
          {expanded && (
            <View style={styles.list}>
              {list}
              {error ? <Text testID="board-error" style={[styles.note, { color: colors.danger }]}>{error}</Text> : null}
              <Pressable testID="board-leave" accessibilityRole="button" onPress={confirmLeave} style={styles.leave}>
                <Text style={[styles.leaveText, { color: colors.danger }]}>{s.leave}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  head: { gap: spacing.xs },
  title: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  headline: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  note: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  input: { minHeight: tapTarget, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.md },
  button: { alignSelf: 'stretch' },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  rank: { width: 28, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  rowName: { flex: 1, fontSize: fontSize.md },
  rowXp: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  leave: { minHeight: tapTarget, justifyContent: 'center', marginTop: spacing.sm },
  leaveText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
