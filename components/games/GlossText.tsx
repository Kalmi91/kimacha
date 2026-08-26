import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { normalizeWordToken } from '@/data/words';
import type { GlossInfo } from '@/lib/games/gloss';

// GAMES.md 3.2: the "kattints rá és kiírja" half of the user's kőbe vésett
// kritérium (0. szekció). Every word is tappable; an `isNew` word additionally
// gets a dotted underline so it reads as "this one is new" before the tap.
//
// K2 DÖNTÉS: a timed game's clock pauses while the bubble is open, this
// component doesn't own a clock, it just calls onOpenGloss/onCloseGloss, the
// game screen wires those to its useGameSession().pause()/resume().
//
// F2 MEGVALÓSÍTÁSI JEGYZET (word-rain 4.1 / bubble-pop 4.2): a catchable/
// poppable tile's own tap already means "catch"/"pop", so it can't ALSO open
// this bubble on tap (word-rain's per-token onPress would fight the game's own
// Pressable). `disableTap` + `forceOpen` + `onForceClose` let a caller drive
// this SAME bubble UI from its own gesture instead: word-rain's automatic
// reveal on a new word's first fall, bubble-pop's long-press. Regular callers
// (word-search's found-word row) are unaffected, `forceOpen` stays `undefined`
// and the component works exactly as before.

interface Props {
  text: string;
  glosses: Map<string, GlossInfo>;
  learnedLang: string;
  style?: StyleProp<TextStyle>;
  onOpenGloss?: () => void;
  onCloseGloss?: () => void;
  disableTap?: boolean; // true: tokens render plain, no internal onPress
  forceOpen?: GlossInfo | null; // externally-controlled bubble (undefined = internal state governs it)
  onForceClose?: () => void; // called instead of the internal close() while forceOpen is controlled
}

export default function GlossText({
  text,
  glosses,
  learnedLang,
  style,
  onOpenGloss,
  onCloseGloss,
  disableTap = false,
  forceOpen,
  onForceClose,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [active, setActive] = useState<GlossInfo | null>(null);
  const [added, setAdded] = useState(false);

  const controlled = forceOpen !== undefined;
  const shown = controlled ? forceOpen : active;

  const open = (info: GlossInfo) => {
    setActive(info);
    setAdded(false);
    onOpenGloss?.();
  };

  const close = () => {
    if (controlled) {
      onForceClose?.();
      return;
    }
    setActive(null);
    onCloseGloss?.();
  };

  const addToSpelling = () => {
    if (!shown?.wordId) return;
    getDb().addToSpellingList(shown.wordId).catch(() => {});
    setAdded(true);
  };

  const parts = text.split(/(\s+)/);

  return (
    <>
      <Text style={style}>
        {parts.map((part, i) => {
          if (!/\S/.test(part)) return part;
          const info = glosses.get(normalizeWordToken(part));
          if (!info) return part;
          const newStyle = info.isNew
            ? { color: colors.tabIconDefault, textDecorationLine: 'underline' as const, textDecorationStyle: 'dotted' as const }
            : undefined;
          if (disableTap) {
            return (
              <Text key={i} style={newStyle}>
                {part}
              </Text>
            );
          }
          return (
            <Text key={i} onPress={() => open(info)} suppressHighlighting style={newStyle}>
              {part}
            </Text>
          );
        })}
      </Text>

      <Modal visible={!!shown} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={[styles.bubble, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.learned, { color: colors.text }]}>{shown?.learned}</Text>
            <Text style={[styles.native, { color: colors.tabIconDefault }]}>{shown?.native}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.iconBtn, { borderColor: colors.tabIconDefault }]}
                onPress={() => shown && speak(shown.learned, speechLang(learnedLang))}
              >
                <Text style={styles.iconBtnText}>🔊</Text>
              </Pressable>
              {shown?.wordId ? (
                <Pressable
                  style={[styles.spellBtn, { backgroundColor: added ? colors.tint : colors.card, borderColor: colors.tint }]}
                  onPress={addToSpelling}
                  disabled={added}
                >
                  <Text style={{ color: added ? '#FFFFFF' : colors.tint }}>{added ? '✓' : s.buttons.spelling}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bubble: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  learned: {
    fontSize: 28,
    fontWeight: '700',
  },
  native: {
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 20,
  },
  spellBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
